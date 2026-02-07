use serde::{Deserialize, Serialize};
use std::cell::RefCell;
use std::collections::{HashMap, HashSet};

const EPSILON: f64 = 1e-9;

#[cfg(target_arch = "wasm32")]
unsafe extern "C" {
    fn now_ms() -> f64;
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SolveInput {
    cuts: Vec<f64>,
    stock_lengths: Vec<f64>,
    kerf: f64,
    time_budget_ms: u64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct Bin {
    stock_length: f64,
    cuts: Vec<f64>,
    used: f64,
    remaining: f64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct PackedSolution {
    bins: Vec<Bin>,
    bin_count: usize,
    total_used: f64,
    total_waste: f64,
    total_stock_length: f64,
    total_kerf_loss: f64,
    utilization: f64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct SolveOutput {
    bins: Vec<Bin>,
    bin_count: usize,
    total_used: f64,
    total_waste: f64,
    total_stock_length: f64,
    total_kerf_loss: f64,
    utilization: f64,
    explored_nodes: u64,
    elapsed_ms: f64,
    termination: String,
    optimality: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ErrorOutput {
    error: String,
}

fn round_to(value: f64, digits: usize) -> f64 {
    let factor = 10_f64.powi(digits as i32);
    (value * factor).round() / factor
}

fn current_time_ms() -> f64 {
    #[cfg(target_arch = "wasm32")]
    unsafe {
        return now_ms();
    }

    #[cfg(not(target_arch = "wasm32"))]
    {
        use std::time::{SystemTime, UNIX_EPOCH};
        let Ok(duration) = SystemTime::now().duration_since(UNIX_EPOCH) else {
            return 0.0;
        };
        duration.as_secs_f64() * 1000.0
    }
}

fn summarize_bins(bins: Vec<Bin>, kerf: f64) -> PackedSolution {
    let total_used = bins.iter().map(|bin| bin.used).sum::<f64>();
    let total_waste = bins
        .iter()
        .map(|bin| if bin.remaining > 0.0 { bin.remaining } else { 0.0 })
        .sum::<f64>();
    let total_stock_length = bins.iter().map(|bin| bin.stock_length).sum::<f64>();

    let total_kerf_loss = bins
        .iter()
        .map(|bin| {
            if bin.cuts.len() <= 1 {
                0.0
            } else {
                (bin.cuts.len() as f64 - 1.0) * kerf
            }
        })
        .sum::<f64>();

    let utilization = if total_stock_length > 0.0 {
        total_used / total_stock_length
    } else {
        0.0
    };

    PackedSolution {
        bin_count: bins.len(),
        bins,
        total_used: round_to(total_used, 3),
        total_waste: round_to(total_waste, 3),
        total_stock_length: round_to(total_stock_length, 3),
        total_kerf_loss: round_to(total_kerf_loss, 3),
        utilization: round_to(utilization, 6),
    }
}

fn evaluate_heuristic(cut_lengths: &[f64], stock_lengths: &[f64], kerf: f64) -> Result<PackedSolution, String> {
    let mut sorted_cuts = cut_lengths.to_vec();
    sorted_cuts.sort_by(|a, b| b.partial_cmp(a).unwrap_or(std::cmp::Ordering::Equal));

    let mut bins: Vec<Bin> = Vec::new();

    for cut_length in sorted_cuts {
        let mut best_kind: Option<(bool, usize, f64, f64)> = None;

        for (index, bin) in bins.iter().enumerate() {
            let extra_kerf = if bin.cuts.is_empty() { 0.0 } else { kerf };
            let remaining_after = bin.remaining - cut_length - extra_kerf;
            if remaining_after < -EPSILON {
                continue;
            }

            match best_kind {
                None => best_kind = Some((true, index, remaining_after, extra_kerf)),
                Some((_, _, best_remaining, _)) => {
                    if remaining_after < best_remaining {
                        best_kind = Some((true, index, remaining_after, extra_kerf));
                    }
                }
            }
        }

        for stock_length in stock_lengths {
            let remaining_after = *stock_length - cut_length;
            if remaining_after < -EPSILON {
                continue;
            }

            match best_kind {
                None => best_kind = Some((false, usize::MAX, remaining_after, 0.0)),
                Some((_, _, best_remaining, _)) => {
                    if remaining_after < best_remaining {
                        best_kind = Some((false, usize::MAX, remaining_after, 0.0));
                    }
                }
            }
        }

        let Some((use_existing, existing_index, _, extra_kerf)) = best_kind else {
            return Err(format!(
                "Cut {:.3} in exceeds all configured stock lengths.",
                cut_length
            ));
        };

        if use_existing {
            let target = bins
                .get_mut(existing_index)
                .ok_or_else(|| "Heuristic internal indexing error.".to_string())?;
            target.cuts.push(cut_length);
            target.used += cut_length + extra_kerf;
            target.remaining = round_to(target.stock_length - target.used, 6);
        } else {
            let stock_length = stock_lengths
                .iter()
                .copied()
                .find(|stock_length| *stock_length - cut_length >= -EPSILON)
                .ok_or_else(|| "No valid stock length found for cut placement.".to_string())?;

            bins.push(Bin {
                stock_length,
                cuts: vec![cut_length],
                used: cut_length,
                remaining: round_to(stock_length - cut_length, 6),
            });
        }
    }

    Ok(summarize_bins(bins, kerf))
}

fn compare_solution(left: &PackedSolution, right: &PackedSolution, kerf: f64) -> std::cmp::Ordering {
    let left_objective = left.total_stock_length + kerf * left.bin_count as f64;
    let right_objective = right.total_stock_length + kerf * right.bin_count as f64;

    if left_objective < right_objective - EPSILON {
        return std::cmp::Ordering::Less;
    }
    if left_objective > right_objective + EPSILON {
        return std::cmp::Ordering::Greater;
    }

    if left.total_waste < right.total_waste - EPSILON {
        return std::cmp::Ordering::Less;
    }
    if left.total_waste > right.total_waste + EPSILON {
        return std::cmp::Ordering::Greater;
    }

    left.bin_count.cmp(&right.bin_count)
}

fn exact_solve(input: &SolveInput) -> Result<SolveOutput, String> {
    let mut unique_stock_lengths = input
        .stock_lengths
        .iter()
        .copied()
        .filter(|value| value.is_finite() && *value > 0.0)
        .collect::<Vec<_>>();
    unique_stock_lengths.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
    unique_stock_lengths.dedup_by(|a, b| (*a - *b).abs() <= EPSILON);

    if unique_stock_lengths.is_empty() {
        return Err("No valid stock lengths available for exact optimization.".to_string());
    }

    let mut sorted_cuts = input
        .cuts
        .iter()
        .copied()
        .filter(|value| value.is_finite() && *value > 0.0)
        .collect::<Vec<_>>();
    sorted_cuts.sort_by(|a, b| b.partial_cmp(a).unwrap_or(std::cmp::Ordering::Equal));

    let start_ms = current_time_ms();

    if sorted_cuts.is_empty() {
        return Ok(SolveOutput {
            bins: Vec::new(),
            bin_count: 0,
            total_used: 0.0,
            total_waste: 0.0,
            total_stock_length: 0.0,
            total_kerf_loss: 0.0,
            utilization: 0.0,
            explored_nodes: 0,
            elapsed_ms: 0.0,
            termination: "completed".to_string(),
            optimality: "proven_optimal".to_string(),
        });
    }

    let max_stock = unique_stock_lengths[unique_stock_lengths.len() - 1];
    if let Some(invalid_cut) = sorted_cuts
        .iter()
        .copied()
        .find(|cut| *cut - max_stock > EPSILON)
    {
        return Err(format!(
            "Cut {:.3} in exceeds all configured stock lengths.",
            invalid_cut
        ));
    }

    let heuristic = evaluate_heuristic(&sorted_cuts, &unique_stock_lengths, input.kerf)?;

    if input.time_budget_ms == 0 {
        return Ok(SolveOutput {
            bins: heuristic.bins,
            bin_count: heuristic.bin_count,
            total_used: heuristic.total_used,
            total_waste: heuristic.total_waste,
            total_stock_length: heuristic.total_stock_length,
            total_kerf_loss: heuristic.total_kerf_loss,
            utilization: heuristic.utilization,
            explored_nodes: 0,
            elapsed_ms: round_to(current_time_ms() - start_ms, 3),
            termination: "timed_out".to_string(),
            optimality: "not_proven".to_string(),
        });
    }

    let mut best = heuristic;
    let mut explored_nodes = 0_u64;
    let mut timed_out = false;

    let deadline_ms = start_ms + input.time_budget_ms as f64;

    let mut remaining_totals = vec![0.0; sorted_cuts.len() + 1];
    for index in (0..sorted_cuts.len()).rev() {
        remaining_totals[index] = remaining_totals[index + 1] + sorted_cuts[index];
    }

    let mut seen_states: HashMap<String, f64> = HashMap::new();

    struct SearchCtx<'a> {
        cuts: &'a [f64],
        stock_lengths: &'a [f64],
        kerf: f64,
        max_stock: f64,
        deadline_ms: f64,
        remaining_totals: &'a [f64],
        seen_states: &'a mut HashMap<String, f64>,
        explored_nodes: &'a mut u64,
        best: &'a mut PackedSolution,
        timed_out: &'a mut bool,
    }

    fn dfs(index: usize, bins: &mut Vec<Bin>, current_stock_length: f64, ctx: &mut SearchCtx<'_>) {
        *ctx.explored_nodes += 1;

        if current_time_ms() > ctx.deadline_ms {
            *ctx.timed_out = true;
            return;
        }

        if *ctx.timed_out {
            return;
        }

        let current_bin_count = bins.len();
        let current_objective = current_stock_length + ctx.kerf * current_bin_count as f64;

        let free_in_open_bins = bins
            .iter()
            .map(|bin| if bin.remaining > 0.0 { bin.remaining } else { 0.0 })
            .sum::<f64>();

        let required_extra = (ctx.remaining_totals[index] - free_in_open_bins).max(0.0);
        let min_new_bins = if required_extra <= EPSILON {
            0
        } else {
            (required_extra / ctx.max_stock).ceil() as usize
        };

        let optimistic_objective = current_stock_length
            + required_extra
            + ctx.kerf * (current_bin_count + min_new_bins) as f64;

        let best_objective = ctx.best.total_stock_length + ctx.kerf * ctx.best.bin_count as f64;
        if optimistic_objective > best_objective + EPSILON {
            return;
        }

        let mut state_parts = bins
            .iter()
            .map(|bin| format!("{:.4}:{:.4}", round_to(bin.stock_length, 4), round_to(bin.remaining, 4)))
            .collect::<Vec<_>>();
        state_parts.sort();
        let state_key = format!("{}|{}", index, state_parts.join("|"));

        if let Some(seen_objective) = ctx.seen_states.get(&state_key)
            && *seen_objective <= current_objective + EPSILON
        {
            return;
        }
        ctx.seen_states.insert(state_key, current_objective);

        if index >= ctx.cuts.len() {
            let candidate = summarize_bins(bins.clone(), ctx.kerf);
            if compare_solution(&candidate, ctx.best, ctx.kerf) == std::cmp::Ordering::Less {
                *ctx.best = candidate;
            }
            return;
        }

        let cut = ctx.cuts[index];
        let mut seen_bin_placements: HashSet<String> = HashSet::new();

        for bin_index in 0..bins.len() {
            let extra_kerf = if bins[bin_index].cuts.is_empty() {
                0.0
            } else {
                ctx.kerf
            };
            let required = cut + extra_kerf;
            if bins[bin_index].remaining - required < -EPSILON {
                continue;
            }

            let next_remaining = round_to(bins[bin_index].remaining - required, 6);
            let placement_key = format!(
                "{:.4}:{:.4}",
                round_to(bins[bin_index].stock_length, 4),
                round_to(next_remaining, 4)
            );
            if seen_bin_placements.contains(&placement_key) {
                continue;
            }
            seen_bin_placements.insert(placement_key);

            bins[bin_index].cuts.push(cut);
            bins[bin_index].used = round_to(bins[bin_index].used + required, 6);
            bins[bin_index].remaining = next_remaining;

            dfs(index + 1, bins, current_stock_length, ctx);

            bins[bin_index].cuts.pop();
            bins[bin_index].used = round_to(bins[bin_index].used - required, 6);
            bins[bin_index].remaining = round_to(bins[bin_index].remaining + required, 6);
        }

        for stock_length in ctx.stock_lengths {
            if *stock_length - cut < -EPSILON {
                continue;
            }

            bins.push(Bin {
                stock_length: *stock_length,
                cuts: vec![cut],
                used: cut,
                remaining: round_to(*stock_length - cut, 6),
            });

            dfs(index + 1, bins, current_stock_length + *stock_length, ctx);

            bins.pop();
        }
    }

    let mut bins: Vec<Bin> = Vec::new();
    let mut ctx = SearchCtx {
        cuts: &sorted_cuts,
        stock_lengths: &unique_stock_lengths,
        kerf: input.kerf,
        max_stock,
        deadline_ms,
        remaining_totals: &remaining_totals,
        seen_states: &mut seen_states,
        explored_nodes: &mut explored_nodes,
        best: &mut best,
        timed_out: &mut timed_out,
    };

    dfs(0, &mut bins, 0.0, &mut ctx);

    Ok(SolveOutput {
        bins: best.bins,
        bin_count: best.bin_count,
        total_used: best.total_used,
        total_waste: best.total_waste,
        total_stock_length: best.total_stock_length,
        total_kerf_loss: best.total_kerf_loss,
        utilization: best.utilization,
        explored_nodes,
        elapsed_ms: round_to(current_time_ms() - start_ms, 3),
        termination: if timed_out {
            "timed_out".to_string()
        } else {
            "completed".to_string()
        },
        optimality: if timed_out {
            "not_proven".to_string()
        } else {
            "proven_optimal".to_string()
        },
    })
}

thread_local! {
    static OUTPUT_BUFFER: RefCell<Vec<u8>> = const { RefCell::new(Vec::new()) };
}

fn set_output_bytes(bytes: Vec<u8>) {
    OUTPUT_BUFFER.with(|buffer| {
        *buffer.borrow_mut() = bytes;
    });
}

fn set_error_output(message: &str) {
    let output = ErrorOutput {
        error: message.to_string(),
    };
    let bytes = serde_json::to_vec(&output).unwrap_or_else(|_| b"{\"error\":\"serialization failure\"}".to_vec());
    set_output_bytes(bytes);
}

#[unsafe(no_mangle)]
pub extern "C" fn alloc(len: usize) -> *mut u8 {
    let mut buffer = Vec::<u8>::with_capacity(len);
    let pointer = buffer.as_mut_ptr();
    std::mem::forget(buffer);
    pointer
}

#[unsafe(no_mangle)]
pub extern "C" fn dealloc(ptr: *mut u8, len: usize) {
    if ptr.is_null() || len == 0 {
        return;
    }

    unsafe {
        drop(Vec::from_raw_parts(ptr, len, len));
    }
}

#[unsafe(no_mangle)]
pub extern "C" fn solve_json(input_ptr: *const u8, input_len: usize) -> i32 {
    if input_ptr.is_null() || input_len == 0 {
        set_error_output("Input buffer is empty.");
        return 0;
    }

    let input_bytes = unsafe { std::slice::from_raw_parts(input_ptr, input_len) };

    let parsed_input = match serde_json::from_slice::<SolveInput>(input_bytes) {
        Ok(value) => value,
        Err(error) => {
            set_error_output(&format!("Invalid solve payload: {error}"));
            return 0;
        }
    };

    let output = match exact_solve(&parsed_input) {
        Ok(result) => serde_json::to_vec(&result)
            .unwrap_or_else(|_| b"{\"error\":\"Failed to serialize solve output\"}".to_vec()),
        Err(error) => {
            set_error_output(&error);
            return 0;
        }
    };

    set_output_bytes(output);
    1
}

#[unsafe(no_mangle)]
pub extern "C" fn output_ptr() -> *const u8 {
    OUTPUT_BUFFER.with(|buffer| buffer.borrow().as_ptr())
}

#[unsafe(no_mangle)]
pub extern "C" fn output_len() -> usize {
    OUTPUT_BUFFER.with(|buffer| buffer.borrow().len())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn fixture_proven_optimal_and_not_worse_than_heuristic() {
        let input = SolveInput {
            cuts: vec![52.0, 48.0, 48.0, 45.0, 36.0, 24.0, 24.0],
            stock_lengths: vec![96.0, 120.0],
            kerf: 0.125,
            time_budget_ms: 3000,
        };

        let heuristic = evaluate_heuristic(&input.cuts, &input.stock_lengths, input.kerf).unwrap();
        let exact = exact_solve(&input).unwrap();

        assert_eq!(exact.termination, "completed");
        assert_eq!(exact.optimality, "proven_optimal");
        assert!(exact.explored_nodes > 0);

        let heuristic_objective = heuristic.total_stock_length + input.kerf * heuristic.bin_count as f64;
        let exact_objective = exact.total_stock_length + input.kerf * exact.bin_count as f64;
        assert!(exact_objective <= heuristic_objective + EPSILON);
    }

    #[test]
    fn fixture_zero_budget_forces_timed_out_status() {
        let input = SolveInput {
            cuts: vec![84.0, 84.0, 84.0, 84.0, 72.0, 72.0, 72.0, 72.0, 66.0, 66.0],
            stock_lengths: vec![96.0, 120.0, 144.0],
            kerf: 0.125,
            time_budget_ms: 0,
        };

        let exact = exact_solve(&input).unwrap();
        assert_eq!(exact.termination, "timed_out");
        assert_eq!(exact.optimality, "not_proven");
    }
}

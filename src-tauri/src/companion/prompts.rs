use super::CompanionRequest;

pub fn system_prompt(mode: &str, language: &str) -> String {
    match mode {
        // ---- COMPLETE: inline ghost-text autocomplete --------------------
        // Goal is a small, code-only, next-step continuation. Do NOT write
        // the whole solution — leave room for the user to keep driving.
        "complete" => format!(
"You are an inline code-completion engine for {lang} inside a live code editor.
Your ONLY job is to produce the next 1–3 lines of code that come after the cursor.

Look at:
- Any comment or docstring above describing what the code should do
- What the user has already written
- The cursor's current indentation

STRICT OUTPUT RULES:
- Output raw code only. No prose. No markdown. No ``` fences. No headings. No leading blank line.
- 1 to 3 lines maximum. Never write the entire solution — write the next step.
- Match the surrounding indentation EXACTLY. If the cursor is mid-expression, continue that expression.
- Never repeat code that already exists above the cursor.
- If a task comment exists, make measurable progress toward it. If not, continue what was started.
- If there is truly nothing meaningful to add, output nothing.",
            lang = language
        ),

        // ---- HINT: ⌘I plain-English nudge --------------------------------
        // Goal is Socratic guidance — help the user THINK, not hand them the
        // answer. Break the problem down. Never write code.
        "hint" => format!(
"You are a patient programming mentor for someone writing {lang}. They pressed a hint key because they are stuck. Treat them as a beginner who may not know where to start.

Read carefully:
- Any comment or docstring describing the task (this is often the problem statement)
- The code they have written so far
- The most recent error message, if any

Your job is to help them figure out the NEXT small step themselves — not to hand them the solution. Break the problem into pieces and point at exactly one of them.

STRICT OUTPUT RULES:
- Plain English only. Do NOT write code. Do NOT paste function names or method calls.
- 1 to 2 sentences, under 30 words total.
- Name the specific sub-step they should tackle right now — or the concept/pattern that applies (loop, map, base case, condition, index bounds…).
- If they haven't started, help them decide the very first thing to do.
- If there is a run error, address it directly and briefly.
- Be direct and encouraging, like a friend at a whiteboard. No filler. No 'great question'. No 'let's think about this'.
- Never dump the answer. Never say 'just use X' without a reason.",
            lang = language
        ),

        _ => "You are a helpful coding assistant.".into(),
    }
}

pub fn user_prompt(req: &CompanionRequest) -> String {
    let mut s = String::new();
    s.push_str("Language: ");
    s.push_str(&req.language);
    s.push_str("\n\nCODE BEFORE CURSOR (ends exactly where the cursor is):\n```");
    s.push_str(&req.language);
    s.push('\n');
    s.push_str(&req.before);
    s.push_str("\n```\n\nCODE AFTER CURSOR:\n```");
    s.push_str(&req.language);
    s.push('\n');
    s.push_str(&req.after);
    s.push_str("\n```");
    if let Some(err) = &req.error {
        if !err.trim().is_empty() {
            s.push_str("\n\nMOST RECENT RUN ERROR:\n");
            s.push_str(err);
        }
    }
    // Feed back previously-given suggestions so the model builds on progress
    // instead of re-issuing the same hint every idle cycle.
    if !req.prev_hints.is_empty() {
        s.push_str(
            "\n\nSUGGESTIONS YOU HAVE ALREADY GIVEN THIS SESSION (do NOT repeat these; assume the user has seen them and pick the NEXT step):\n",
        );
        for (i, h) in req.prev_hints.iter().enumerate() {
            s.push_str(&format!("{}. {}\n", i + 1, h.trim()));
        }
    }
    s
}

# Gum CLI Enhancement

When `gum` is installed (check with `which gum`), use it to enhance CLI output.

## What Works

```bash
# Styled boxes for summaries
gum style --border rounded --padding "1 2" "Your message here"

# Multi-line boxes
gum style --border double --padding "1 2" --width 50 "$(echo -e "Title\n\n✓ Item one\n✓ Item two")"

# Horizontal status cards
gum join --horizontal \
  "$(gum style --border rounded --padding '0 1' '✓ Done')" \
  "$(gum style --border rounded --padding '0 1' '⏳ Pending')"

# Structured logs (no color but readable)
gum log --level info "Message"
gum log --level warn "Warning"
gum log --level error "Error"
```

## What Doesn't Work (needs TTY)

- `gum table` - use markdown tables instead
- `gum spin` - escape codes garbled
- `gum choose/confirm/input` - interactive, needs TTY
- ANSI colors - get escaped in output

## When to Use

- Task completion summaries
- Status dashboards
- Before/after comparisons
- Error/success reporting

## Border Styles

`--border` options: `rounded`, `double`, `thick`, `normal`, `hidden`, `none`

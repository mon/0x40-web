<script lang="ts">
  import type { Snippet } from "svelte";

  let {
    value = $bindable(),
    children,
    min,
    max,
    step,
  }: {
    value?: number;
    children: Snippet;
    min: number;
    max: number;
    step: number;
  } = $props();

  let realValue = $state(value ?? min);
  let enabled = $state(value !== undefined);
  $effect(() => {
    value = enabled ? realValue : undefined;
  });
</script>

<div class="control-group">
  <input type="checkbox" bind:checked={enabled} />
  <label>{@render children?.()}</label>
  <div class="control-row">
    <input type="range" bind:value={realValue} {min} {max} {step} />
  </div>
</div>

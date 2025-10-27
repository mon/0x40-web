<script lang="ts">
  import type { Snippet } from "svelte";

  let {
    value = $bindable(),
    children,
    min,
    max,
    step,
  }: {
    value: number;
    children: Snippet;
    min: number;
    max: number;
    step: number;
  } = $props();
</script>

<div class="control-group">
  <label>{@render children?.()}</label>
  <div class="control-row">
    <input type="range" bind:value {min} {max} {step} />
  </div>
</div>

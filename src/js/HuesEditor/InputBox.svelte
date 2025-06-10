<script lang="ts">
  import uniqueFormId from "../UniqueID";

  interface Props {
    label?: string;
    value: string;
    placeholder?: string;
    disabled?: boolean;
  }

  let {
    label = "",
    value = $bindable(),
    placeholder = "",
    disabled = false,
  }: Props = $props();

  let id = uniqueFormId();
</script>

<label for={id}>{@html label}</label>
<input type="text" bind:value {placeholder} {id} {disabled} />

<style>
  label {
    grid-column: 1;
  }

  input {
    grid-column: 2;
    font-family: "PetMe64Web";
    font-size: 7pt;
    margin-right: 5px;
    padding: 3px;
    border-color: rgb(0, 0, 0);
    border-width: 1px;
    border-style: solid;
  }
</style>

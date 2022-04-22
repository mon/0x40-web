<script>
    export let label;
    export let unit;
    export let value = "N/A";
</script>

<span class="label">{label}{label ? ':' : ''}</span>
<span class="val">{value}</span>
<span class="unit">{unit}</span>

<style>
span {
    padding-right: 1em;
}
.label {
    grid-column: 1;
}
.unit {
    grid-column: 3;
}
.val {
    grid-column: 2;
    text-align: right;
    min-width: 6ch;
}
</style>

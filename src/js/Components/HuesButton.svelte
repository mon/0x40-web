<script lang="ts">
    export let icon = false;
    export let disabled = false;
    export let loaded = false;
    export let glow = false;
    // some situations require an opaque button
    export let opaque = false;
    export let title = "";
    export let nouppercase = false;
</script>

<button
    on:click
    {disabled}
    class:loaded
    class:glow
    class:opaque
    class:nouppercase
    class="{icon ? 'hues-icon' : ''}"
    {title}
>
    <slot></slot>
</button>

<style>
button {
    font-size: 10px;
    font-family: inherit;
    margin: 3px 2px;
    padding: 3px;
    background-color: rgba(127,127,127, 0.5);
    border-color: rgb(0,0,0);
    border-width: 1px;
    border-style: solid;
    cursor: pointer;
    text-transform: uppercase;
    /* Don't want double click to select */
    user-select: none;
}

button.nouppercase {
    text-transform: none;
}

button:hover {
    background: rgba(255,255,255, 0.5);
}

button.opaque {
    /* because of the pseudo element this one can't be transparent */
    background-color: rgb(171,171,171);
}

button.opaque:hover {
    background-color: rgb(236,236,236) !important;
}

.loaded {
    background-color: rgba(0,127,0,0.5);
    cursor: default;
}

button:disabled {
    color: #777;
    cursor: default;
}

.loaded:hover {
    background-color: rgba(0,127,0,0.5);
    cursor: default;
}

button:disabled:hover {
    background-color: rgba(127,127,127, 0.5);
}

.glow {
    animation-name: glow;
    animation-duration: 2s;
    animation-iteration-count: infinite;
}

@keyframes glow {
    from {
    background-color: rgba(127,127,127, 0.5);
    }
    50%  {
    background-color: rgba(0,127,0,0.5);
    }
    to {
    background-color: rgba(127,127,127, 0.5);
    }
}
</style>

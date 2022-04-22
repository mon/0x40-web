<script>
    import HuesButton from '../Components/HuesButton.svelte';

    import { createEventDispatcher } from 'svelte';

    export let unlocked = true;
    export let disabled = false;

    $: realUnlocked = unlocked || disabled;

    const dispatch = createEventDispatcher();

    let click = () => {
        unlocked = !unlocked;
        dispatch('click');
    };
</script>

<div class="timelock-border" class:unlocked="{realUnlocked}"></div>
<div class="hues-icon timelock" class:unlocked="{realUnlocked}">
    <!-- CHAIN-BROKEN / CHAIN -->
    <HuesButton
        opaque
        {disabled}
        on:click={click}
        title="Lock Buildup/Rhythm beat lengths">
            {@html realUnlocked ? '&#xe904;' : '&#xe905;'}
    </HuesButton>
</div>

<style>
.timelock {
    grid-column: editor-link;
    grid-row: buildup-header / rhythm-editor;
    align-self: center;
    /* isn't quite centered with just the grid-row */
    margin-top: -6px;
}

.timelock-border {
    grid-column: editor-link;
    grid-row: buildup-header / rhythm-header;

    width: 5px;
    margin-left: 9px;
    margin-top: 10px;
    margin-bottom: -12px;
    border-left: 3px #666 solid;
    border-top: 3px #666 solid;
    border-bottom: 3px #666 solid;
}

.timelock-border.unlocked {
    border-left: 3px #666 dashed;
}
</style>

<script>
    import HuesSetting from "./HuesSetting.svelte";
    import { afterUpdate, createEventDispatcher } from 'svelte';

    // To dynamically build the UI like the cool guy I am
    const settingsCategories = {
        "Functionality" : [
            "autoSong",
            "autoSongShuffle",
            "autoSongFadeout",
            "playBuildups"
        ],
        "Graphics" : [
            "blurAmount",
            "blurDecay",
            "blurQuality",
            "trippyMode"
        ],
        "Visuals" : [
            "smartAlign",
            "shuffleImages",
            "colourSet",
            "visualiser"
        ],
        "Interface" : [
            "currentUI",
            "blackoutUI",
            "skipPreloader"
        ]
    };

    export let settings = {};
    export let schema = {};

    $: autoPlural = settings["autoSongDelay"] > 1 ? 's' : '';

    // until we convert the rest of the app to svelte, this lets consumers
    // update their own state more simply
    const dispatch = createEventDispatcher();
    afterUpdate(() => {
        dispatch('update')
    })
</script>

<div class="options">
    {#each Object.entries(settingsCategories) as [catName, cats]}
        <div class="category">
            {catName}
            {#each cats as setName}
                <HuesSetting bind:value={settings[setName]} info={schema[setName]}>
                    <!-- This is the only setting that has custom logic so just put
                     it here instead of the schema -->
                    {#if setName == "autoSong" && settings["autoSong"] != "off"}
                        <span>after</span>
                        <input
                            class="settings-input"
                            type="number"
                            min=1
                            bind:value={settings["autoSongDelay"]}
                        />
                        {#if settings["autoSong"] == "loop"}
                            <span>loop{autoPlural}</span>
                        {:else if settings["autoSong"] == "time"}
                            <span>min{autoPlural}</span>
                        {/if}
                    {/if}
                </HuesSetting>
            {/each}
        </div>
    {/each}
</div>

<style>
.options {
    display:flex;
    flex-wrap: wrap;
    width: 640px;
    padding: 5px;
}

.category {
    font-size: 16px;
    width: 50%;
    float: left;
    margin-bottom: 10px;
}

span {
    font-size: 7pt;
    align-self: center;
}

:global(.settings-input) {
    font-family: 'PetMe64Web';
    font-size: 7pt;
    margin: 4px 2px;
    padding: 3px;
    background: rgba(127,127,127, 0.5);
    border-color: rgb(0,0,0);
    border-width: 1px;
    border-style: solid;
    width: 2em;

    -moz-appearance:textfield; /* Firefox no spinbox */
}

/* hide the spin box on number input */
:global(.settings-input)::-webkit-outer-spin-button,
:global(.settings-input)::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0; /* <-- Apparently some margin are still there even though it's hidden */
}
</style>

<script lang="ts">
    export let version: string;
    export let huesName: string;

    $: name = huesName.replace("%VERSION%", version);

    import HuesInfoList from './HuesInfoList.svelte';

    const beatGlossary = [
        "x Vertical blur, image and colour (snare)",
        "o Horizontal blur, image and colour (bass)",
        "- Change image and colour (no blur)",
        ": Colour only",
        "* Image only",
        "X Vertical blur only",
        "O Horizontal blur only",
        "+¤ Blackout/whiteout (classic)",
        "|! Blackout/whiteout (short)",
        "┊¡ Blackout/whiteout (instant)",
        "▽▼ Blackout/whiteout (fade out)",
        "△▲ Blackout/whiteout (fade in)",
        ")( Trippy cirle in/out and change image",
        ">< Trippy cirle in/out",
        "~ Fade colour",
        "= Fade and change image",
        "i Invert all colours",
        "I Invert & change image",
        "sv Horizontal/vertical slice",
        "SV Horizontal/vertical slice and change image",
        "# Double slice",
        "@ Double slice and change image",
        "←↓↑→ Shutter",
        "¯ Stop all effects in bank immediately",
        "_ Stop timed effects (fade, slice etc)",
    ];

    const shortcuts = [
        "↑↓  Change song",
        "←→  Change image",
        "[N] Random song",
        "-+  Change volume",
        "[M] Toggle mute",
        "[B] Restart song from build",
        "[F] Toggle automode",
        "[H] Toggle UI hide",
        "[C] Character list",
        "[S] Song list",
        "[W] Toggle window",
        "[R] Resource packs",
        "[L] Load local zip",
        "[O] Options",
        "[I] Information",
        "[1-6] Change UI",
        "[Alt+Enter] Fullscreen"
    ];
</script>

<div class="ref">
    <div class="about">
        <h1>{name}</h1>
        <h2>Adapted from the <a target="_blank" href="http://0x40hues.blogspot.com">0x40 Flash</a></h2>
        <h2>Web-ified by <a target="_blank" href="https://github.com/mon">mon</a></h2>
        <h3>With help from <a target="_blank" href="https://github.com/kepstin/0x40hues-html5">Kepstin</a></h3>
    </div>
    <HuesInfoList name="Beat glossary" items={beatGlossary}/>
    <HuesInfoList name="Keyboard shortcuts" items={shortcuts}/>
</div>

<style>
.ref {
    display:flex;
    flex-wrap: wrap;
    max-width: 640px;
    align-items:center;
    justify-content: center;
    padding: 5px;
}

.about {
    border-bottom: 2px solid black;
}
</style>

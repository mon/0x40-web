<script>
    export let version;
    export let huesName;

    $: name = huesName.replace("%VERSION%", version);

    import HuesInfoList from './HuesInfoList.svelte';

    const beatGlossary = [
        "x Vertical blur (snare)",
        "o Horizontal blur (bass)",
        "- No blur",
        "+ Blackout",
        "¤ Whiteout",
        "| Short blackout",
        "! Short whiteout",
        ": Color only",
        "* Image only",
        "X Vertical blur only",
        "O Horizontal blur only",
        ") Trippy cirle in",
        "( Trippy circle out",
        "~ Fade color",
        "= Fade and change image",
        "i Invert all colours",
        "I Invert & change image",
        "s Horizontal slice",
        "S Horizontal slice and change image",
        "v Vertical slice",
        "V Vertical slice and change image",
        "# Double slice",
        "@ Double slice and change image",
        "←↓↑→ Shutter",
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
    width: 640px;
    align-items:center;
    justify-content: center;
    padding: 5px;
}

.about {
    border-bottom: 2px solid black;
}
</style>

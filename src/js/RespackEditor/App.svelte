<script lang="ts">
import { Respack } from "../ResourcePack";
import ImageEdit from "./ImageEdit.svelte";

export let pack: Respack | undefined;

let fileInput: HTMLInputElement;

const newPack = () => {
    if(pack === undefined || confirm("You're about to nuke it, and there is no undo. Continue?")) {
        pack = new Respack();
    }
};

const savePack = () => {
    pack!.saveZIP();
}

const loadPack = async () => {
    const files = fileInput.files;
    if(!files || files.length < 1) {
        return;
    }

    const r = new Respack();
    await r.loadFromBlob(files[0]);
    pack = r;
}

</script>

<h1>HE HAS NO STYLE, HE HAS NO GRACE. THIS RESPACK EDITOR HAS A FUNNY FACE.</h1>

<div>
    <button on:click={newPack}>Brand new pack</button>
    <span>or...</span>
    <input type="file" accept="application/zip" on:change={loadPack} bind:this={fileInput}/>
</div>

{#if pack}
<div>
    <div>
        <button on:click={savePack} disabled={!pack}>Save pack</button>

        <label for="pack-name">Name:</label>
        <input id="pack-name" type="text" bind:value={pack.name}/>

        <label for="pack-author">Author:</label>
        <input id="pack-author" type="text" bind:value={pack.author}/>

        <label for="pack-description">Description:</label>
        <input id="pack-description" type="text" bind:value={pack.description}/>

        <label for="pack-link">Link:</label>
        <input id="pack-link" type="text" bind:value={pack.link}/>
    </div>

    <!-- todo: tabs instead of all in one page -->
    <ImageEdit images={pack.images} />

    <div>Songs: {pack.songs.length}</div>
    <table>
        <tr>
            <th>Title</th>
            <th>Source</th>
            <th>Banks</th>
            <th>Loop len</th>
            <th>Loop file</th>
            <th>Build len</th>
            <th>Build file</th>
            <th>charsPerBeat</th>
            <th>independentBuild</th>
        </tr>
        {#each pack.songs as song}
        <tr>
            <td><input type="text" bind:value={song.title} /></td>
            <td><input type="text" bind:value={song.source} /></td>
            <td>{song.bankCount}</td>
            <td>{song.loop.mapLen}</td>
            <td>{song.loop.filename}</td>
            <td>{song.build ? song.build.mapLen : "n/a"}</td>
            <td>{song.build ? song.build.filename : "n/a"}</td>
            <td>{song.charsPerBeat}</td>
            <td>
                {#if song.build}
                <input type="checkbox" bind:value={song.independentBuild} />
                {:else}
                n/a
                {/if}
            </td>
        </tr>
        {/each}
    </table>

    <div>Images: {pack.images.length}</div>
    <table>
        <tr>
            <th>Name</th>
            <th>Full name</th>
            <th>Source</th>
            <th>Align</th>
            <th>Img #</th>
            <th>frameDurations</th>
            <th>beatsPerAnim</th>
            <th>syncOffset</th>
        </tr>
        {#each pack.images as image}
        <tr>
            <td><input type="text" bind:value={image.name} /></td>
            <td><input type="text" bind:value={image.fullname} /></td>
            <td><input type="text" bind:value={image.source} /></td>
            <td>
                <select bind:value={image.align}>
                    <option>center</option>
                    <option>left</option>
                    <option>right</option>
                </select>
            </td>
            <td>{image.bitmaps.length}</td>
            <td>
                {#if image.animated}
                <input type="text" bind:value={image.rawFrameDurations} />
                {:else}
                n/a
                {/if}
            </td>
            <td>
                {#if image.animated}
                <input type="number" bind:value={image.beatsPerAnim} />
                {:else}
                n/a
                {/if}
            </td>
            <td>
                {#if image.animated}
                <input type="number" bind:value={image.syncOffset} />
                {:else}
                n/a
                {/if}
            </td>
        </tr>
        {/each}
    </table>
</div>
{:else}
Load a pack, ya dingus
{/if}

<style>
table {
    border-collapse: collapse;
}

th, td {
    border: 1px solid black;
}
</style>

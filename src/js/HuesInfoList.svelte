<script lang="ts">
    export let name: string;
    export let items: string[];
</script>

<div>
    <h3>{name}</h3>
    <ul>
        {#each items as item}
            <li>{item}</li>
        {/each}
    </ul>
</div>

<style>
div {
    float: left;
    font-size: 8pt;
    text-align: left;
    background: rgba(100,100,100,0.3);
    border-radius: 15px;
    margin: 10px;
    padding: 0 5px;
}

h3 {
    font-size: 10pt;
    margin: 10px 0 0 10px;
    text-align: left;
}

ul {
    list-style-type: none;
    padding: 0;
    margin: 10px;
}

li {
    /* Chrome rendering fix */
    line-height: 9pt;
}
</style>

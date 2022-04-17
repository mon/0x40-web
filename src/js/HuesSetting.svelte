<script>
    import uniqueFormId from './UniqueID';

    export let info;
    export let value;

    const setId = uniqueFormId();
</script>

<div class="setting">
    {info.name}
    <div class="buttons">
        {#each info.options as opt}
            {@const inputId = uniqueFormId()}
            <input
                type="radio"
                value="{opt}"
                name="{setId}"
                id="{inputId}"
                bind:group={value}
            />
            <label for="{inputId}">{opt}</label>
        {/each}
        <slot></slot>
    </div>
</div>

<style>
.setting{
    font-size: 8pt;
    /* Chrome rendering fix */
    line-height: 9pt;
    padding-left: 10px;
}

.buttons{
    display: flex;
    flex-wrap: wrap;
}

input[type="radio"]{
    display: none;
}

label {
    font-size: 7pt;
    text-transform: uppercase;
    margin: 4px 2px;
    padding: 3px;
    background: rgba(127,127,127, 0.5);
    border-color: rgb(0,0,0);
    border-width: 1px;
    border-style: solid;
    cursor: pointer;
    /* Don't want double click to select */
    -webkit-touch-callout: none;
    -webkit-user-select: none;
    -khtml-user-select: none;
    -moz-user-select: none;
    -ms-user-select: none;
    user-select: none;
}

label:hover {
    background: rgba(200,200,200,0.5);
}

input[type="radio"]:checked + label {
    background: rgba(255,255,255, 0.5);
}
</style>

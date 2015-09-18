Self.prototype.updateVolume = function(muted, gain) {
    var label = this.volLabel
    var input = this.volInput

    var text = gain.toFixed(1) + "dB"
    if (muted) {
        text = "(" + text + ")"
    }
    label.textContent = text
    input.value = gain
}

Self.prototype.setupVolume = function(box) {
    var volBar = box.ownerDocument.createElement("div")
    volBar.className = "hues-m-vol-bar"
    box.appendChild(volBar)

    var label = box.ownerDocument.createElement("button")
    volBar.appendChild(label)
    this.volLabel = label
    label.addEventListener("click", (function() {
        if (this.core.isMuted()) {
            this.core.unmute()
        } else {
            this.core.mute()
        }
    }).bind(this))

    var input = box.ownerDocument.createElement("input")
    input.type = "range"
    input.min = -60
    input.max = 5
    input.step = 1
    volBar.appendChild(input)
    this.volInput = input
    input.addEventListener("input", (function() {
        this.core.setVolume(parseFloat(input.value))
    }).bind(this))

    this.updateVolume(this.core.isMuted(), this.core.getVolume())
    Hues.addEventListener("volumechange", this.updateVolume.bind(this))
}
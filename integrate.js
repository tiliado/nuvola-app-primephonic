/*
 * Copyright 2020 Jiří Janoušek <janousek.jiri@gmail.com>
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *
 * 1. Redistributions of source code must retain the above copyright notice, this
 *    list of conditions and the following disclaimer.
 * 2. Redistributions in binary form must reproduce the above copyright notice,
 *    this list of conditions and the following disclaimer in the documentation
 *    and/or other materials provided with the distribution.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
 * ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE FOR
 * ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
 * (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
 * LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
 * ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
 * SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

'use strict';

(function (Nuvola) {
  // Create media player component
  const player = Nuvola.$object(Nuvola.MediaPlayer)

  // Handy aliases
  const PlaybackState = Nuvola.PlaybackState
  const PlayerAction = Nuvola.PlayerAction

  // Create new WebApp prototype
  const WebApp = Nuvola.$WebApp()

  // Initialization routines
  WebApp._onInitWebWorker = function (emitter) {
    Nuvola.WebApp._onInitWebWorker.call(this, emitter)

    const state = document.readyState
    if (state === 'interactive' || state === 'complete') {
      this._onPageReady()
    } else {
      document.addEventListener('DOMContentLoaded', this._onPageReady.bind(this))
    }
  }

  // Page is ready for magic
  WebApp._onPageReady = function () {
    // Connect handler for signal ActionActivated
    Nuvola.actions.connect('ActionActivated', this)

    // Start update routine
    this.update()
  }

  // Extract data from the web page
  WebApp.update = function () {
    const elms = this._getElements()
    const [currentTime, totalTime] = this._getTrackTime()

    const track = {
      title: Nuvola.queryText('footer.player-wrapper .work'),
      artist: Nuvola.queryText('footer.player-wrapper .composer'),
      album: null,
      artLocation: Nuvola.queryAttribute('#header-image img', 'src'),
      rating: null,
      length: totalTime
    }

    let state
    if (!track.title && !track.artist) {
      state = PlaybackState.UNKNOWN
    } else if (elms.pause) {
      state = PlaybackState.PLAYING
    } else if (elms.play) {
      state = PlaybackState.PAUSED
    } else {
      state = PlaybackState.UNKNOWN
    }

    player.setPlaybackState(state)
    player.setTrack(track)
    player.setTrackPosition(currentTime)

    const volumeMark = elms.volumebar ? elms.volumebar.firstElementChild : null
    if (volumeMark && volumeMark.style.width.includes('%')) {
      player.updateVolume(volumeMark.style.width.replace('%', '') / 100)
    }
    player.setCanChangeVolume(false)
    player.setCanSeek(false)

    player.setCanGoPrev(!!elms.prev)
    player.setCanGoNext(!!elms.next)
    player.setCanPlay(!!elms.play)
    player.setCanPause(!!elms.pause)

    player.setCanShuffle(!!elms.shuffle)
    player.setShuffleState(elms.shuffle ? !!elms.shuffleOn : null)

    player.setCanRepeat(!!elms.repeat)
    player.setRepeatState(this._getRepeatState(elms))

    // Schedule the next update
    setTimeout(this.update.bind(this), 500)
  }

  // Handler of playback actions
  WebApp._onActionActivated = function (emitter, name, param) {
    const elms = this._getElements()
    switch (name) {
      case PlayerAction.TOGGLE_PLAY:
        if (elms.play) {
          Nuvola.clickOnElement(elms.play)
        } else {
          Nuvola.clickOnElement(elms.pause)
        }
        break
      case PlayerAction.PLAY:
        Nuvola.clickOnElement(elms.play)
        break
      case PlayerAction.PAUSE:
      case PlayerAction.STOP:
        Nuvola.clickOnElement(elms.pause)
        break
      case PlayerAction.PREV_SONG:
        Nuvola.clickOnElement(elms.prev)
        break
      case PlayerAction.NEXT_SONG:
        Nuvola.clickOnElement(elms.next)
        break
      case PlayerAction.SHUFFLE:
        Nuvola.clickOnElement(elms.shuffle)
        break
      case PlayerAction.REPEAT:
        this._setRepeatState(elms, param)
        break
    }
  }

  WebApp._getElements = function () {
    const HTMLButtonElement = window.HTMLButtonElement
    let actions = document.querySelector('footer.player-wrapper .playing-controls-actions')
    actions = actions ? actions.childNodes : []

    const elms = {
      play: actions[3] instanceof HTMLButtonElement ? actions[3] : null,
      pause: null,
      next: actions[4] instanceof HTMLButtonElement ? actions[4] : null,
      prev: actions[2] instanceof HTMLButtonElement ? actions[2] : null,
      repeatNone: actions[5] instanceof HTMLButtonElement ? actions[5] : null,
      repeatAll: actions[6] instanceof HTMLButtonElement ? actions[6] : null,
      repeatOne: actions[7] instanceof HTMLButtonElement ? actions[7] : null,
      shuffleOff: actions[0] instanceof HTMLButtonElement ? actions[0] : null,
      shuffleOn: actions[1] instanceof HTMLButtonElement ? actions[1] : null,
      progressbar: document.querySelector('footer.player-wrapper .progress-bar'),
      volumebar: document.querySelector('footer.player-wrapper .volume-bar')
    }

    elms.shuffle = elms.shuffleOff || elms.shuffleOn
    elms.repeat = elms.repeatAll || elms.repeatOne || elms.repeatNone

    // Ignore disabled buttons
    for (const key in elms) {
      if (elms[key] && elms[key].disabled) {
        elms[key] = null
      }
    }

    // Distinguish between play and pause action
    if (elms.play && elms.play.firstChild === elms.play.firstElementChild) {
      elms.pause = elms.play
      elms.play = null
    }
    return elms
  }

  WebApp._getTrackTime = function () {
    let current = Nuvola.queryText('footer.player-wrapper .progress span')
    let total = Nuvola.queryText('footer.player-wrapper .progress span#toggle-remainging span')
    if (!current || !total) {
      return [null, null]
    }
    current = Nuvola.parseTimeUsec(current)
    total = total.startsWith('-') ? current + Nuvola.parseTimeUsec(total.substr(1)) : Nuvola.parseTimeUsec(total)
    return [current, total]
  }

  WebApp._getRepeatState = function (elms) {
    const elm = elms.repeat
    if (!elm) {
      return null
    }

    if (elm === elms.repeatNone) {
      return Nuvola.PlayerRepeat.NONE
    }
    if (elm === elms.repeatAll) {
      return Nuvola.PlayerRepeat.PLAYLIST
    }
    if (elm === elms.repeatOne) {
      return Nuvola.PlayerRepeat.TRACK
    }
    return null
  }

  WebApp._setRepeatState = function (elms, repeat) {
    if (this._getRepeatState(elms) !== repeat) {
      Nuvola.clickOnElement(elms.repeat)
      window.setTimeout(() => this._setRepeatState(this._getElements(), repeat), 100)
    }
  }

  WebApp.start()
})(this) // function(Nuvola)

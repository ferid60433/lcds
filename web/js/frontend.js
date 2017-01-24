/** global: updateScreenUrl */

/**
 * Screen class constructor
 * @param {string} updateScreenUrl global screen update checks url
 */
function Screen(updateScreenUrl) {
  this.fields = [];
  this.url = updateScreenUrl;
  this.lastChanges = null;
  this.endAt = null;
  this.nextUrl = null;
  this.cache = new Preload();
}

/**
 * Ajax GET on updateScreenUrl to check lastChanges timestamp and reload if necessary
 */
Screen.prototype.checkUpdates = function() {
  var s = this;
  $.get(this.url, function(j) {
    if (j.success) {
      if (s.lastChanges == null) {
        s.lastChanges = j.data.lastChanges;
      } else if (s.lastChanges != j.data.lastChanges) {
        // Remote screen updated, we should reload as soon as possible
        s.reloadIn(0);
        s.nextUrl = null;
        return;
      }

      if (j.data.duration > 0) {
        // Setup next screen
        s.reloadIn(j.data.duration * 1000);
        s.nextUrl = j.data.nextScreenUrl;
      }
    } else if (j.message == 'Unauthorized') {
      // Cookie/session gone bad, try to refresh with full screen reload
      screen.reloadIn(0);
    }
  });
}

/**
 * Start Screen reload procedure, checking for every field timeout
 */
Screen.prototype.reloadIn = function(minDuration) {
  var endAt = Date.now() + minDuration;
  if (this.endAt != null && this.endAt < endAt) {
    // Already going to reload sooner than asked
    return;
  }

  if (this.cache.hasPreloadingContent(true)) {
    // Do not break preloading
    return;
  }

  this.endAt = Date.now() + minDuration;
  for (var i in this.fields) {
    if (!this.fields.hasOwnProperty(i)) {
      continue;
    }
    var f = this.fields[i];
    if (f.timeout && f.endAt > this.endAt) {
      // Always wait for content display end
      this.endAt = f.endAt;
    }
  }

  if (Date.now() >= this.endAt) {
    // No content to delay reload, do it now
    this.reloadNow();
  }
}

/**
 * Actual Screen reload/change screen action
 */
Screen.prototype.reloadNow = function() {
  if (this.nextUrl) {
    window.location = this.nextUrl;
  } else {
    window.location.reload();
  }
}

/**
 * Check every field for content
 * @param  {Content} data 
 * @return {boolean} content is displayed
 */
Screen.prototype.displaysData = function(data) {
  return this.fields.filter(function(field) {
    return field.current && field.current.data == data;
  }).length > 0;
}

/**
 * Trigger pickNext on all fields
 */
Screen.prototype.newContentTrigger = function() {
  for (var f in this.fields) {
    if (!this.fields.hasOwnProperty(f)) {
      continue;
    }

    this.fields[f].pickNextIfNecessary();
  }
}

/**
 * Loop through all fields for stuckiness state
 * @return {Boolean} are all fields stuck
 */
Screen.prototype.isAllFieldsStuck = function() {
  for (var f in this.fields) {
    if (!this.fields.hasOwnProperty(f)) {
      continue;
    }

    if (!this.fields[f].stuck && this.fields[f].canUpdate) {
      return false;
    }
  }

  return true;
}


/**
 * Content class constructor
 * @param {array} c content attributes
 */
function Content(c) {
  this.id = c.id;
  this.data = c.data;
  this.duration = c.duration * 1000;
  this.type = c.type;
  this.src = null;

  if (this.shouldPreload()) {
    this.queuePreload();
  }
}

/**
 * Check if content should be ajax preloaded
 * @return {boolean}
 */
Content.prototype.shouldPreload = function() {
  return this.canPreload() && !this.isPreloadingOrQueued() && !this.isPreloaded();
}

/**
 * Check if content has pre-loadable material
 * @return {boolean} 
 */
Content.prototype.canPreload = function() {
  return this.getResource() && this.type.search(/Video|Image|Agenda/) != -1;
}

/**
 * Check if content is displayable (preloaded and not too long)
 * @return {Boolean} can display
 */
Content.prototype.canDisplay = function() {
  return (screen.endAt == null || Date.now() + this.duration < screen.endAt) && this.isPreloaded();
}

/**
 * Extract url from contant data
 * @return {string} resource url
 */
Content.prototype.getResource = function() {
  if (this.src) {
    return this.src;
  }
  var srcMatch = this.data.match(/src="([^"]+)"/);
  if (!srcMatch) {
    // All preloadable content comes with a src attribute
    return false;
  }
  var src = srcMatch[1];
  if (src.indexOf('/') === 0) {
    src = window.location.origin + src;
  }
  if (src.indexOf('http') !== 0) {
    return false;
  }
  // Get rid of fragment
  src = src.replace(/#.*/g, '');

  this.src = src;
  return src;
}

/** Set content cache status
 * @param {string} expires header
 */
Content.prototype.setPreloadState = function(expires) {
  screen.cache.setState(this.getResource(), expires);
}

/**
 * Check cache for preload status of content
 * @return {Boolean} 
 */
Content.prototype.isPreloaded = function() {
  if (!this.canPreload()) {
    return true;
  }

  return screen.cache.isPreloaded(this.getResource());
}

/**
 * Check cache for in progress or future preloading
 * @return {Boolean} is preloading
 */
Content.prototype.isPreloadingOrQueued = function() {
  return this.isPreloading() || this.isInPreloadQueue();
}

/**
 * Check cache for in progress preloading
 * @return {Boolean} is preloading
 */
Content.prototype.isPreloading = function() {
  return screen.cache.isPreloading(this.getResource());
}

/**
 * Check cache for queued preloading
 * @return {Boolean} is in preload queue
 */
Content.prototype.isInPreloadQueue = function() {
  return screen.cache.isInPreloadQueue(this.getResource());
}

/**
 * Ajax call to preload content
 */
Content.prototype.preload = function() {
  var src = this.getResource();
  if (!src) {
    return;
  }

  screen.cache.preload(src);
}

/**
 * Preload content or add to preload queue
 */
Content.prototype.queuePreload = function() {
  var src = this.getResource();
  if (!src) {
    return;
  }

  if (screen.cache.hasPreloadingContent(false)) {
    this.setPreloadState(Preload.state.PRELOADING_QUEUE);
  } else {
    this.preload();
  }
}


/**
 * Preload class constructor
 * Build cache map
 */
function Preload() {
  this.cache = {};
}

/**
 * Set resource cache state
 * @param {string} res     resource url
 * @param {string|int} expires header or preload state
 */
Preload.prototype.setState = function(res, expires) {
  if (expires === null || expires == '') {
    expires = Preload.state.NO_EXPIRE_HEADER;
  }

  this.cache[res] = expires < -1 ? expires : Preload.state.OK
}

/**
 * Check resource cache for readyness state
 * @param  {string}  res resource url
 * @return {Boolean}     is preloaded
 */
Preload.prototype.isPreloaded = function(res) {
  var state = this.cache[res];

  return state === Preload.state.OK || state === Preload.state.NO_EXPIRE_HEADER;
}

/**
 * Check resource cache for preloading state
 * @param  {string}  res resource url
 * @return {Boolean}     is currently preloading
 */
Preload.prototype.isPreloading = function(res) {
  return this.cache[res] === Preload.state.PRELOADING;
}

/**
 * Check resource cache for queued preloading state
 * @param  {string}  res resource url
 * @return {Boolean}     is in preload queue
 */
Preload.prototype.isInPreloadQueue = function(res) {
  return this.cache[res] === Preload.state.PRELOADING_QUEUE;
}

/**
 * Scan resource cache for preloading resources
 * @param  {Boolean}  withQueue also check preload queue
 * @return {Boolean}           has any resource preloading/in preload queue
 */
Preload.prototype.hasPreloadingContent = function(withQueue) {
  for (var res in this.cache) {
    if (!this.cache.hasOwnProperty(res)) {
      continue;
    }

    if (this.isPreloading(res) || (withQueue && this.isInPreloadQueue(res))) {
      return true;
    }
  }

  return false;
}

/**
 * Preload a resource by ajax get on the url
 * Check HTTP return state to validate proper cache
 * @param  {string} res resource url
 */
Preload.prototype.preload = function(res) {
  this.setState(res, Preload.state.PRELOADING);

  $.ajax(res).done(function(data, textStatus, jqXHR) {
    // Preload success
    screen.cache.setState(res, jqXHR.getResponseHeader('Expires'));
    screen.newContentTrigger();
  }).fail(function() {
    // Preload failure
    screen.cache.setState(res, Preload.state.HTTP_FAIL);
  }).always(function() {
    var res = screen.cache.next();
    if (res) {
      // Preload ended, next resource
      screen.cache.preload(res);
    } else {
      // We've gone through all queued resources
      // Trigger another update to calculate a proper screen.endAt value
      screen.checkUpdates();
    }
  });
}

/**
 * Get next resource to preload from queue
 * @return {string|null} next resource url
 */
Preload.prototype.next = function() {
  for (var res in this.cache) {
    if (!this.cache.hasOwnProperty(res)) {
      continue;
    }

    if (this.isInPreloadQueue(res)) {
      return res;
    }
  }
  return null;
}

/**
 * Preload states
 */
Preload.state = {
  PRELOADING: -2,
  PRELOADING_QUEUE: -3,
  HTTP_FAIL: -4,
  NO_EXPIRE_HEADER: -5,
  OK: -6,
}


/**
 * Field class constructor
 * @param {jQuery.Object} $f field object
 */
function Field($f) {
  this.$field = $f;
  this.id = $f.attr('data-id');
  this.url = $f.attr('data-url');
  this.types = $f.attr('data-types').split(' ');
  this.canUpdate = this.url != null;
  this.contents = [];
  this.previous = null;
  this.current = null;
  this.next = null;
  this.timeout = null;
  this.endAt = null;
  this.stuck = false;
}

/**
 * Retrieves contents from backend for this field
 */
Field.prototype.fetchContents = function() {
  if (!this.canUpdate) {
    return;
  }

  var f = this;
  $.get(this.url, function(j) {
    if (j.success) {
      f.contents = j.next.map(function(c) {
        return new Content(c);
      });
      f.pickNextIfNecessary();
    } else {
      f.setError(j.message || 'Error');
    }
  });
}

/**
 * Display error in field text
 */
Field.prototype.setError = function(err) {
  this.display(err);
}

/**
 * Randomize order
 */
Field.prototype.randomizeSortContents = function() {
  this.contents = this.contents.sort(function() {
    return Math.random() - 0.5;
  });
}

/**
 * PickNext if no content currently displayed and content is available
 */
Field.prototype.pickNextIfNecessary = function() {
  if (!this.timeout && this.contents.length) {
    this.pickNext();
  }
}

/**
 * Loop through field contents to pick next displayable content
 */
Field.prototype.pickNext = function() {
  if (screen.endAt != null && Date.now() >= screen.endAt) {
    // Currently trying to reload, we're past threshold: reload now
    screen.reloadNow();
    return;
  }

  this.previous = this.current;
  this.current = null;
  var previousData = this.previous && this.previous.data;

  this.next = this.pickRandomContent(previousData) || this.pickRandomContent(previousData, true);

  if (this.next) {
    // Overwrite field with newly picked content
    this.displayNext();
    this.stuck = false;
  } else {
    // I am stuck, don't know what to display
    this.stuck = true;
    // Check other fields for stuckiness state
    if (screen.isAllFieldsStuck() && !screen.cache.hasPreloadingContent(true)) {
      // Nothing to do. Give up, reload now
      screen.reloadNow();
    }
  }
}

/**
 * Loop through field contents for any displayable content
 * @param  {string}  previousData previous content data
 * @param {Boolean} anyUsable ignore constraints
 * @return {Content} random usable content
 */
Field.prototype.pickRandomContent = function(previousData, anyUsable) {
  this.randomizeSortContents();
  for (var i = 0; i < this.contents.length; i++) {
    var c = this.contents[i];
    // Skip too long or not preloaded content 
    if (!c.canDisplay()) {
      continue;
    }

    if (anyUsable) {
      // Ignore repeat & same content constraints if necessary
      return c;
    }

    // Avoid repeat same content
    if (c.data == previousData) {
      // Not enough content, display anyway
      if (this.contents.length < 2) {
        return c;
      }
      continue;
    }

    // Avoid same content than already displayed on other fields
    if (screen.displaysData(c.data)) {
      // Not enough content, display anyway
      if (this.contents.length < 3) {
        return c;
      }
      continue;
    }

    // Nice content. Display it.
    return c;
  }
  return null;
}

/**
 * Setup next content for field and display it
 */
Field.prototype.displayNext = function() {
  var f = this;
  if (this.next && this.next.duration > 0) {
    this.current = this.next
    this.next = null;
    this.display(this.current.data);
    if (this.timeout) {
      clearTimeout(this.timeout);
    }
    this.endAt = Date.now() + this.current.duration;
    this.timeout = setTimeout(function() {
      f.pickNext();
    }, this.current.duration);
  }
}

/**
 * Display data in field HTML
 * @param  {string} data 
 */
Field.prototype.display = function(data) {
  this.$field.html(data);
  this.$field.show();
  if (this.$field.text() != '') {
    this.$field.textfill({
      maxFontPixels: 0,
    });
  }
}

// Global screen instance
var screen = null;

/**
 * jQuery.load event
 * Initialize Screen and Fields
 * Setup updates interval timeouts
 */
function onLoad() {
  screen = new Screen(updateScreenUrl);
  // Init
  $('.field').each(function() {
    var f = new Field($(this));
    screen.fields.push(f);
    f.fetchContents();
  });

  if (screen.url) {
    // Setup content updates loop
    setInterval(function() {
      for (var f in screen.fields) {
        if (screen.fields.hasOwnProperty(f)) {
          screen.fields[f].fetchContents();
        }
      }
      screen.checkUpdates();
    }, 60000); // 1 minute is enough alongside preload queue end trigger
    screen.checkUpdates();
  }
}

// Run
$(onLoad);

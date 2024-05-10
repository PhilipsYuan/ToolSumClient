/*! @name @videojs/http-streaming @version 3.9.1 @license Apache-2.0 */
import document from 'global/document';
import window$1 from 'global/window';
import _extends from '@babel/runtime/helpers/extends';
import _resolveUrl from '@videojs/vhs-utils/es/resolve-url.js';
import videojs from 'video.js';
import { Parser } from 'm3u8-parser';
import { isAudioCodec, translateLegacyCodec, codecsFromDefault, parseCodecs, getMimeForCodec, DEFAULT_VIDEO_CODEC, DEFAULT_AUDIO_CODEC, browserSupportsCodec, muxerSupportsCodec } from '@videojs/vhs-utils/es/codecs.js';
import { simpleTypeFromSourceType } from '@videojs/vhs-utils/es/media-types.js';
export { simpleTypeFromSourceType } from '@videojs/vhs-utils/es/media-types.js';
import { isArrayBufferView, concatTypedArrays, stringToBytes, toUint8 } from '@videojs/vhs-utils/es/byte-helpers';
import { generateSidxKey, parseUTCTiming, parse, addSidxSegmentsToPlaylist } from 'mpd-parser';
import parseSidx from 'mux.js/lib/tools/parse-sidx';
import { getId3Offset } from '@videojs/vhs-utils/es/id3-helpers';
import { detectContainerForBytes, isLikelyFmp4MediaSegment } from '@videojs/vhs-utils/es/containers';
import { ONE_SECOND_IN_TS } from 'mux.js/lib/utils/clock';

/**
 * @file resolve-url.js - Handling how URLs are resolved and manipulated
 */
const resolveUrl = _resolveUrl;
/**
 * If the xhr request was redirected, return the responseURL, otherwise,
 * return the original url.
 *
 * @api private
 *
 * @param  {string} url - an url being requested
 * @param  {XMLHttpRequest} req - xhr request result
 *
 * @return {string}
 */

const resolveManifestRedirect = (url, req) => {
  // To understand how the responseURL below is set and generated:
  // - https://fetch.spec.whatwg.org/#concept-response-url
  // - https://fetch.spec.whatwg.org/#atomic-http-redirect-handling
  if (req && req.responseURL && url !== req.responseURL) {
    return req.responseURL;
  }

  return url;
};

const logger = source => {
  if (videojs.log.debug) {
    return videojs.log.debug.bind(videojs, 'VHS:', `${source} >`);
  }

  return function () {};
};

/**
 * Provides a compatibility layer between Video.js 7 and 8 API changes for VHS.
 */
/**
 * Delegates to videojs.obj.merge (Video.js 8) or
 * videojs.mergeOptions (Video.js 7).
 */

function merge(...args) {
  const context = videojs.obj || videojs;
  const fn = context.merge || context.mergeOptions;
  return fn.apply(context, args);
}
/**
 * Delegates to videojs.time.createTimeRanges (Video.js 8) or
 * videojs.createTimeRanges (Video.js 7).
 */

function createTimeRanges(...args) {
  const context = videojs.time || videojs;
  const fn = context.createTimeRanges || context.createTimeRanges;
  return fn.apply(context, args);
}

/**
 * ranges
 *
 * Utilities for working with TimeRanges.
 *
 */

const TIME_FUDGE_FACTOR = 1 / 30; // Comparisons between time values such as current time and the end of the buffered range
// can be misleading because of precision differences or when the current media has poorly
// aligned audio and video, which can cause values to be slightly off from what you would
// expect. This value is what we consider to be safe to use in such comparisons to account
// for these scenarios.

const SAFE_TIME_DELTA = TIME_FUDGE_FACTOR * 3;

const filterRanges = function (timeRanges, predicate) {
  const results = [];
  let i;

  if (timeRanges && timeRanges.length) {
    // Search for ranges that match the predicate
    for (i = 0; i < timeRanges.length; i++) {
      if (predicate(timeRanges.start(i), timeRanges.end(i))) {
        results.push([timeRanges.start(i), timeRanges.end(i)]);
      }
    }
  }

  return createTimeRanges(results);
};
/**
 * Attempts to find the buffered TimeRange that contains the specified
 * time.
 *
 * @param {TimeRanges} buffered - the TimeRanges object to query
 * @param {number} time  - the time to filter on.
 * @return {TimeRanges} a new TimeRanges object
 */


const findRange = function (buffered, time) {
  return filterRanges(buffered, function (start, end) {
    return start - SAFE_TIME_DELTA <= time && end + SAFE_TIME_DELTA >= time;
  });
};
/**
 * Returns the TimeRanges that begin later than the specified time.
 *
 * @param {TimeRanges} timeRanges - the TimeRanges object to query
 * @param {number} time - the time to filter on.
 * @return {TimeRanges} a new TimeRanges object.
 */

const findNextRange = function (timeRanges, time) {
  return filterRanges(timeRanges, function (start) {
    return start - TIME_FUDGE_FACTOR >= time;
  });
};
/**
 * Returns gaps within a list of TimeRanges
 *
 * @param {TimeRanges} buffered - the TimeRanges object
 * @return {TimeRanges} a TimeRanges object of gaps
 */

const findGaps = function (buffered) {
  if (buffered.length < 2) {
    return createTimeRanges();
  }

  const ranges = [];

  for (let i = 1; i < buffered.length; i++) {
    const start = buffered.end(i - 1);
    const end = buffered.start(i);
    ranges.push([start, end]);
  }

  return createTimeRanges(ranges);
};
/**
 * Calculate the intersection of two TimeRanges
 *
 * @param {TimeRanges} bufferA
 * @param {TimeRanges} bufferB
 * @return {TimeRanges} The interesection of `bufferA` with `bufferB`
 */

const bufferIntersection = function (bufferA, bufferB) {
  let start = null;
  let end = null;
  let arity = 0;
  const extents = [];
  const ranges = [];

  if (!bufferA || !bufferA.length || !bufferB || !bufferB.length) {
    return createTimeRanges();
  } // Handle the case where we have both buffers and create an
  // intersection of the two


  let count = bufferA.length; // A) Gather up all start and end times

  while (count--) {
    extents.push({
      time: bufferA.start(count),
      type: 'start'
    });
    extents.push({
      time: bufferA.end(count),
      type: 'end'
    });
  }

  count = bufferB.length;

  while (count--) {
    extents.push({
      time: bufferB.start(count),
      type: 'start'
    });
    extents.push({
      time: bufferB.end(count),
      type: 'end'
    });
  } // B) Sort them by time


  extents.sort(function (a, b) {
    return a.time - b.time;
  }); // C) Go along one by one incrementing arity for start and decrementing
  //    arity for ends

  for (count = 0; count < extents.length; count++) {
    if (extents[count].type === 'start') {
      arity++; // D) If arity is ever incremented to 2 we are entering an
      //    overlapping range

      if (arity === 2) {
        start = extents[count].time;
      }
    } else if (extents[count].type === 'end') {
      arity--; // E) If arity is ever decremented to 1 we leaving an
      //    overlapping range

      if (arity === 1) {
        end = extents[count].time;
      }
    } // F) Record overlapping ranges


    if (start !== null && end !== null) {
      ranges.push([start, end]);
      start = null;
      end = null;
    }
  }

  return createTimeRanges(ranges);
};
/**
 * Gets a human readable string for a TimeRange
 *
 * @param {TimeRange} range
 * @return {string} a human readable string
 */

const printableRange = range => {
  const strArr = [];

  if (!range || !range.length) {
    return '';
  }

  for (let i = 0; i < range.length; i++) {
    strArr.push(range.start(i) + ' => ' + range.end(i));
  }

  return strArr.join(', ');
};
/**
 * Calculates the amount of time left in seconds until the player hits the end of the
 * buffer and causes a rebuffer
 *
 * @param {TimeRange} buffered
 *        The state of the buffer
 * @param {Numnber} currentTime
 *        The current time of the player
 * @param {number} playbackRate
 *        The current playback rate of the player. Defaults to 1.
 * @return {number}
 *         Time until the player has to start rebuffering in seconds.
 * @function timeUntilRebuffer
 */

const timeUntilRebuffer = function (buffered, currentTime, playbackRate = 1) {
  const bufferedEnd = buffered.length ? buffered.end(buffered.length - 1) : 0;
  return (bufferedEnd - currentTime) / playbackRate;
};
/**
 * Converts a TimeRanges object into an array representation
 *
 * @param {TimeRanges} timeRanges
 * @return {Array}
 */

const timeRangesToArray = timeRanges => {
  const timeRangesList = [];

  for (let i = 0; i < timeRanges.length; i++) {
    timeRangesList.push({
      start: timeRanges.start(i),
      end: timeRanges.end(i)
    });
  }

  return timeRangesList;
};
/**
 * Determines if two time range objects are different.
 *
 * @param {TimeRange} a
 *        the first time range object to check
 *
 * @param {TimeRange} b
 *        the second time range object to check
 *
 * @return {Boolean}
 *         Whether the time range objects differ
 */

const isRangeDifferent = function (a, b) {
  // same object
  if (a === b) {
    return false;
  } // one or the other is undefined


  if (!a && b || !b && a) {
    return true;
  } // length is different


  if (a.length !== b.length) {
    return true;
  } // see if any start/end pair is different


  for (let i = 0; i < a.length; i++) {
    if (a.start(i) !== b.start(i) || a.end(i) !== b.end(i)) {
      return true;
    }
  } // if the length and every pair is the same
  // this is the same time range


  return false;
};
const lastBufferedEnd = function (a) {
  if (!a || !a.length || !a.end) {
    return;
  }

  return a.end(a.length - 1);
};
/**
 * A utility function to add up the amount of time in a timeRange
 * after a specified startTime.
 * ie:[[0, 10], [20, 40], [50, 60]] with a startTime 0
 *     would return 40 as there are 40s seconds after 0 in the timeRange
 *
 * @param {TimeRange} range
 *        The range to check against
 * @param {number} startTime
 *        The time in the time range that you should start counting from
 *
 * @return {number}
 *          The number of seconds in the buffer passed the specified time.
 */

const timeAheadOf = function (range, startTime) {
  let time = 0;

  if (!range || !range.length) {
    return time;
  }

  for (let i = 0; i < range.length; i++) {
    const start = range.start(i);
    const end = range.end(i); // startTime is after this range entirely

    if (startTime > end) {
      continue;
    } // startTime is within this range


    if (startTime > start && startTime <= end) {
      time += end - startTime;
      continue;
    } // startTime is before this range.


    time += end - start;
  }

  return time;
};

/**
 * @file playlist.js
 *
 * Playlist related utilities.
 */
/**
 * Get the duration of a segment, with special cases for
 * llhls segments that do not have a duration yet.
 *
 * @param {Object} playlist
 *        the playlist that the segment belongs to.
 * @param {Object} segment
 *        the segment to get a duration for.
 *
 * @return {number}
 *          the segment duration
 */

const segmentDurationWithParts = (playlist, segment) => {
  // if this isn't a preload segment
  // then we will have a segment duration that is accurate.
  if (!segment.preload) {
    return segment.duration;
  } // otherwise we have to add up parts and preload hints
  // to get an up to date duration.


  let result = 0;
  (segment.parts || []).forEach(function (p) {
    result += p.duration;
  }); // for preload hints we have to use partTargetDuration
  // as they won't even have a duration yet.

  (segment.preloadHints || []).forEach(function (p) {
    if (p.type === 'PART') {
      result += playlist.partTargetDuration;
    }
  });
  return result;
};
/**
 * A function to get a combined list of parts and segments with durations
 * and indexes.
 *
 * @param {Playlist} playlist the playlist to get the list for.
 *
 * @return {Array} The part/segment list.
 */

const getPartsAndSegments = playlist => (playlist.segments || []).reduce((acc, segment, si) => {
  if (segment.parts) {
    segment.parts.forEach(function (part, pi) {
      acc.push({
        duration: part.duration,
        segmentIndex: si,
        partIndex: pi,
        part,
        segment
      });
    });
  } else {
    acc.push({
      duration: segment.duration,
      segmentIndex: si,
      partIndex: null,
      segment,
      part: null
    });
  }

  return acc;
}, []);
const getLastParts = media => {
  const lastSegment = media.segments && media.segments.length && media.segments[media.segments.length - 1];
  return lastSegment && lastSegment.parts || [];
};
const getKnownPartCount = ({
  preloadSegment
}) => {
  if (!preloadSegment) {
    return;
  }

  const {
    parts,
    preloadHints
  } = preloadSegment;
  let partCount = (preloadHints || []).reduce((count, hint) => count + (hint.type === 'PART' ? 1 : 0), 0);
  partCount += parts && parts.length ? parts.length : 0;
  return partCount;
};
/**
 * Get the number of seconds to delay from the end of a
 * live playlist.
 *
 * @param {Playlist} main the main playlist
 * @param {Playlist} media the media playlist
 * @return {number} the hold back in seconds.
 */

const liveEdgeDelay = (main, media) => {
  if (media.endList) {
    return 0;
  } // dash suggestedPresentationDelay trumps everything


  if (main && main.suggestedPresentationDelay) {
    return main.suggestedPresentationDelay;
  }

  const hasParts = getLastParts(media).length > 0; // look for "part" delays from ll-hls first

  if (hasParts && media.serverControl && media.serverControl.partHoldBack) {
    return media.serverControl.partHoldBack;
  } else if (hasParts && media.partTargetDuration) {
    return media.partTargetDuration * 3; // finally look for full segment delays
  } else if (media.serverControl && media.serverControl.holdBack) {
    return media.serverControl.holdBack;
  } else if (media.targetDuration) {
    return media.targetDuration * 3;
  }

  return 0;
};
/**
 * walk backward until we find a duration we can use
 * or return a failure
 *
 * @param {Playlist} playlist the playlist to walk through
 * @param {Number} endSequence the mediaSequence to stop walking on
 */

const backwardDuration = function (playlist, endSequence) {
  let result = 0;
  let i = endSequence - playlist.mediaSequence; // if a start time is available for segment immediately following
  // the interval, use it

  let segment = playlist.segments[i]; // Walk backward until we find the latest segment with timeline
  // information that is earlier than endSequence

  if (segment) {
    if (typeof segment.start !== 'undefined') {
      return {
        result: segment.start,
        precise: true
      };
    }

    if (typeof segment.end !== 'undefined') {
      return {
        result: segment.end - segment.duration,
        precise: true
      };
    }
  }

  while (i--) {
    segment = playlist.segments[i];

    if (typeof segment.end !== 'undefined') {
      return {
        result: result + segment.end,
        precise: true
      };
    }

    result += segmentDurationWithParts(playlist, segment);

    if (typeof segment.start !== 'undefined') {
      return {
        result: result + segment.start,
        precise: true
      };
    }
  }

  return {
    result,
    precise: false
  };
};
/**
 * walk forward until we find a duration we can use
 * or return a failure
 *
 * @param {Playlist} playlist the playlist to walk through
 * @param {number} endSequence the mediaSequence to stop walking on
 */


const forwardDuration = function (playlist, endSequence) {
  let result = 0;
  let segment;
  let i = endSequence - playlist.mediaSequence; // Walk forward until we find the earliest segment with timeline
  // information

  for (; i < playlist.segments.length; i++) {
    segment = playlist.segments[i];

    if (typeof segment.start !== 'undefined') {
      return {
        result: segment.start - result,
        precise: true
      };
    }

    result += segmentDurationWithParts(playlist, segment);

    if (typeof segment.end !== 'undefined') {
      return {
        result: segment.end - result,
        precise: true
      };
    }
  } // indicate we didn't find a useful duration estimate


  return {
    result: -1,
    precise: false
  };
};
/**
  * Calculate the media duration from the segments associated with a
  * playlist. The duration of a subinterval of the available segments
  * may be calculated by specifying an end index.
  *
  * @param {Object} playlist a media playlist object
  * @param {number=} endSequence an exclusive upper boundary
  * for the playlist.  Defaults to playlist length.
  * @param {number} expired the amount of time that has dropped
  * off the front of the playlist in a live scenario
  * @return {number} the duration between the first available segment
  * and end index.
  */


const intervalDuration = function (playlist, endSequence, expired) {
  if (typeof endSequence === 'undefined') {
    endSequence = playlist.mediaSequence + playlist.segments.length;
  }

  if (endSequence < playlist.mediaSequence) {
    return 0;
  } // do a backward walk to estimate the duration


  const backward = backwardDuration(playlist, endSequence);

  if (backward.precise) {
    // if we were able to base our duration estimate on timing
    // information provided directly from the Media Source, return
    // it
    return backward.result;
  } // walk forward to see if a precise duration estimate can be made
  // that way


  const forward = forwardDuration(playlist, endSequence);

  if (forward.precise) {
    // we found a segment that has been buffered and so it's
    // position is known precisely
    return forward.result;
  } // return the less-precise, playlist-based duration estimate


  return backward.result + expired;
};
/**
  * Calculates the duration of a playlist. If a start and end index
  * are specified, the duration will be for the subset of the media
  * timeline between those two indices. The total duration for live
  * playlists is always Infinity.
  *
  * @param {Object} playlist a media playlist object
  * @param {number=} endSequence an exclusive upper
  * boundary for the playlist. Defaults to the playlist media
  * sequence number plus its length.
  * @param {number=} expired the amount of time that has
  * dropped off the front of the playlist in a live scenario
  * @return {number} the duration between the start index and end
  * index.
  */


const duration = function (playlist, endSequence, expired) {
  if (!playlist) {
    return 0;
  }

  if (typeof expired !== 'number') {
    expired = 0;
  } // if a slice of the total duration is not requested, use
  // playlist-level duration indicators when they're present


  if (typeof endSequence === 'undefined') {
    // if present, use the duration specified in the playlist
    if (playlist.totalDuration) {
      return playlist.totalDuration;
    } // duration should be Infinity for live playlists


    if (!playlist.endList) {
      return window$1.Infinity;
    }
  } // calculate the total duration based on the segment durations


  return intervalDuration(playlist, endSequence, expired);
};
/**
  * Calculate the time between two indexes in the current playlist
  * neight the start- nor the end-index need to be within the current
  * playlist in which case, the targetDuration of the playlist is used
  * to approximate the durations of the segments
  *
  * @param {Array} options.durationList list to iterate over for durations.
  * @param {number} options.defaultDuration duration to use for elements before or after the durationList
  * @param {number} options.startIndex partsAndSegments index to start
  * @param {number} options.endIndex partsAndSegments index to end.
  * @return {number} the number of seconds between startIndex and endIndex
  */

const sumDurations = function ({
  defaultDuration,
  durationList,
  startIndex,
  endIndex
}) {
  let durations = 0;

  if (startIndex > endIndex) {
    [startIndex, endIndex] = [endIndex, startIndex];
  }

  if (startIndex < 0) {
    for (let i = startIndex; i < Math.min(0, endIndex); i++) {
      durations += defaultDuration;
    }

    startIndex = 0;
  }

  for (let i = startIndex; i < endIndex; i++) {
    durations += durationList[i].duration;
  }

  return durations;
};
/**
 * Calculates the playlist end time
 *
 * @param {Object} playlist a media playlist object
 * @param {number=} expired the amount of time that has
 *                  dropped off the front of the playlist in a live scenario
 * @param {boolean|false} useSafeLiveEnd a boolean value indicating whether or not the
 *                        playlist end calculation should consider the safe live end
 *                        (truncate the playlist end by three segments). This is normally
 *                        used for calculating the end of the playlist's seekable range.
 *                        This takes into account the value of liveEdgePadding.
 *                        Setting liveEdgePadding to 0 is equivalent to setting this to false.
 * @param {number} liveEdgePadding a number indicating how far from the end of the playlist we should be in seconds.
 *                 If this is provided, it is used in the safe live end calculation.
 *                 Setting useSafeLiveEnd=false or liveEdgePadding=0 are equivalent.
 *                 Corresponds to suggestedPresentationDelay in DASH manifests.
 * @return {number} the end time of playlist
 * @function playlistEnd
 */

const playlistEnd = function (playlist, expired, useSafeLiveEnd, liveEdgePadding) {
  if (!playlist || !playlist.segments) {
    return null;
  }

  if (playlist.endList) {
    return duration(playlist);
  }

  if (expired === null) {
    return null;
  }

  expired = expired || 0;
  let lastSegmentEndTime = intervalDuration(playlist, playlist.mediaSequence + playlist.segments.length, expired);

  if (useSafeLiveEnd) {
    liveEdgePadding = typeof liveEdgePadding === 'number' ? liveEdgePadding : liveEdgeDelay(null, playlist);
    lastSegmentEndTime -= liveEdgePadding;
  } // don't return a time less than zero


  return Math.max(0, lastSegmentEndTime);
};
/**
  * Calculates the interval of time that is currently seekable in a
  * playlist. The returned time ranges are relative to the earliest
  * moment in the specified playlist that is still available. A full
  * seekable implementation for live streams would need to offset
  * these values by the duration of content that has expired from the
  * stream.
  *
  * @param {Object} playlist a media playlist object
  * dropped off the front of the playlist in a live scenario
  * @param {number=} expired the amount of time that has
  * dropped off the front of the playlist in a live scenario
  * @param {number} liveEdgePadding how far from the end of the playlist we should be in seconds.
  *        Corresponds to suggestedPresentationDelay in DASH manifests.
  * @return {TimeRanges} the periods of time that are valid targets
  * for seeking
  */

const seekable = function (playlist, expired, liveEdgePadding) {
  const useSafeLiveEnd = true;
  const seekableStart = expired || 0;
  let seekableEnd = playlistEnd(playlist, expired, useSafeLiveEnd, liveEdgePadding);

  if (seekableEnd === null) {
    return createTimeRanges();
  } // Clamp seekable end since it can not be less than the seekable start


  if (seekableEnd < seekableStart) {
    seekableEnd = seekableStart;
  }

  return createTimeRanges(seekableStart, seekableEnd);
};
/**
 * Determine the index and estimated starting time of the segment that
 * contains a specified playback position in a media playlist.
 *
 * @param {Object} options.playlist the media playlist to query
 * @param {number} options.currentTime The number of seconds since the earliest
 * possible position to determine the containing segment for
 * @param {number} options.startTime the time when the segment/part starts
 * @param {number} options.startingSegmentIndex the segment index to start looking at.
 * @param {number?} [options.startingPartIndex] the part index to look at within the segment.
 *
 * @return {Object} an object with partIndex, segmentIndex, and startTime.
 */

const getMediaInfoForTime = function ({
  playlist,
  currentTime,
  startingSegmentIndex,
  startingPartIndex,
  startTime,
  exactManifestTimings
}) {
  let time = currentTime - startTime;
  const partsAndSegments = getPartsAndSegments(playlist);
  let startIndex = 0;

  for (let i = 0; i < partsAndSegments.length; i++) {
    const partAndSegment = partsAndSegments[i];

    if (startingSegmentIndex !== partAndSegment.segmentIndex) {
      continue;
    } // skip this if part index does not match.


    if (typeof startingPartIndex === 'number' && typeof partAndSegment.partIndex === 'number' && startingPartIndex !== partAndSegment.partIndex) {
      continue;
    }

    startIndex = i;
    break;
  }

  if (time < 0) {
    // Walk backward from startIndex in the playlist, adding durations
    // until we find a segment that contains `time` and return it
    if (startIndex > 0) {
      for (let i = startIndex - 1; i >= 0; i--) {
        const partAndSegment = partsAndSegments[i];
        time += partAndSegment.duration;

        if (exactManifestTimings) {
          if (time < 0) {
            continue;
          }
        } else if (time + TIME_FUDGE_FACTOR <= 0) {
          continue;
        }

        return {
          partIndex: partAndSegment.partIndex,
          segmentIndex: partAndSegment.segmentIndex,
          startTime: startTime - sumDurations({
            defaultDuration: playlist.targetDuration,
            durationList: partsAndSegments,
            startIndex,
            endIndex: i
          })
        };
      }
    } // We were unable to find a good segment within the playlist
    // so select the first segment


    return {
      partIndex: partsAndSegments[0] && partsAndSegments[0].partIndex || null,
      segmentIndex: partsAndSegments[0] && partsAndSegments[0].segmentIndex || 0,
      startTime: currentTime
    };
  } // When startIndex is negative, we first walk forward to first segment
  // adding target durations. If we "run out of time" before getting to
  // the first segment, return the first segment


  if (startIndex < 0) {
    for (let i = startIndex; i < 0; i++) {
      time -= playlist.targetDuration;

      if (time < 0) {
        return {
          partIndex: partsAndSegments[0] && partsAndSegments[0].partIndex || null,
          segmentIndex: partsAndSegments[0] && partsAndSegments[0].segmentIndex || 0,
          startTime: currentTime
        };
      }
    }

    startIndex = 0;
  } // Walk forward from startIndex in the playlist, subtracting durations
  // until we find a segment that contains `time` and return it


  for (let i = startIndex; i < partsAndSegments.length; i++) {
    const partAndSegment = partsAndSegments[i];
    time -= partAndSegment.duration;
    const canUseFudgeFactor = partAndSegment.duration > TIME_FUDGE_FACTOR;
    const isExactlyAtTheEnd = time === 0;
    const isExtremelyCloseToTheEnd = canUseFudgeFactor && time + TIME_FUDGE_FACTOR >= 0;

    if (isExactlyAtTheEnd || isExtremelyCloseToTheEnd) {
      // 1) We are exactly at the end of the current segment.
      // 2) We are extremely close to the end of the current segment (The difference is less than  1 / 30).
      //    We may encounter this situation when
      //    we don't have exact match between segment duration info in the manifest and the actual duration of the segment
      //    For example:
      //    We appended 3 segments 10 seconds each, meaning we should have 30 sec buffered,
      //    but we the actual buffered is 29.99999
      //
      // In both cases:
      // if we passed current time -> it means that we already played current segment
      // if we passed buffered.end -> it means that this segment is already loaded and buffered
      // we should select the next segment if we have one:
      if (i !== partsAndSegments.length - 1) {
        continue;
      }
    }

    if (exactManifestTimings) {
      if (time > 0) {
        continue;
      }
    } else if (time - TIME_FUDGE_FACTOR >= 0) {
      continue;
    }

    return {
      partIndex: partAndSegment.partIndex,
      segmentIndex: partAndSegment.segmentIndex,
      startTime: startTime + sumDurations({
        defaultDuration: playlist.targetDuration,
        durationList: partsAndSegments,
        startIndex,
        endIndex: i
      })
    };
  } // We are out of possible candidates so load the last one...


  return {
    segmentIndex: partsAndSegments[partsAndSegments.length - 1].segmentIndex,
    partIndex: partsAndSegments[partsAndSegments.length - 1].partIndex,
    startTime: currentTime
  };
};
/**
 * Check whether the playlist is excluded or not.
 *
 * @param {Object} playlist the media playlist object
 * @return {boolean} whether the playlist is excluded or not
 * @function isExcluded
 */

const isExcluded = function (playlist) {
  return playlist.excludeUntil && playlist.excludeUntil > Date.now();
};
/**
 * Check whether the playlist is compatible with current playback configuration or has
 * been excluded permanently for being incompatible.
 *
 * @param {Object} playlist the media playlist object
 * @return {boolean} whether the playlist is incompatible or not
 * @function isIncompatible
 */

const isIncompatible = function (playlist) {
  return playlist.excludeUntil && playlist.excludeUntil === Infinity;
};
/**
 * Check whether the playlist is enabled or not.
 *
 * @param {Object} playlist the media playlist object
 * @return {boolean} whether the playlist is enabled or not
 * @function isEnabled
 */

const isEnabled = function (playlist) {
  const excluded = isExcluded(playlist);
  return !playlist.disabled && !excluded;
};
/**
 * Check whether the playlist has been manually disabled through the representations api.
 *
 * @param {Object} playlist the media playlist object
 * @return {boolean} whether the playlist is disabled manually or not
 * @function isDisabled
 */

const isDisabled = function (playlist) {
  return playlist.disabled;
};
/**
 * Returns whether the current playlist is an AES encrypted HLS stream
 *
 * @return {boolean} true if it's an AES encrypted HLS stream
 */

const isAes = function (media) {
  for (let i = 0; i < media.segments.length; i++) {
    if (media.segments[i].key) {
      return true;
    }
  }

  return false;
};
/**
 * Checks if the playlist has a value for the specified attribute
 *
 * @param {string} attr
 *        Attribute to check for
 * @param {Object} playlist
 *        The media playlist object
 * @return {boolean}
 *         Whether the playlist contains a value for the attribute or not
 * @function hasAttribute
 */

const hasAttribute = function (attr, playlist) {
  return playlist.attributes && playlist.attributes[attr];
};
/**
 * Estimates the time required to complete a segment download from the specified playlist
 *
 * @param {number} segmentDuration
 *        Duration of requested segment
 * @param {number} bandwidth
 *        Current measured bandwidth of the player
 * @param {Object} playlist
 *        The media playlist object
 * @param {number=} bytesReceived
 *        Number of bytes already received for the request. Defaults to 0
 * @return {number|NaN}
 *         The estimated time to request the segment. NaN if bandwidth information for
 *         the given playlist is unavailable
 * @function estimateSegmentRequestTime
 */

const estimateSegmentRequestTime = function (segmentDuration, bandwidth, playlist, bytesReceived = 0) {
  if (!hasAttribute('BANDWIDTH', playlist)) {
    return NaN;
  }

  const size = segmentDuration * playlist.attributes.BANDWIDTH;
  return (size - bytesReceived * 8) / bandwidth;
};
/*
 * Returns whether the current playlist is the lowest rendition
 *
 * @return {Boolean} true if on lowest rendition
 */

const isLowestEnabledRendition = (main, media) => {
  if (main.playlists.length === 1) {
    return true;
  }

  const currentBandwidth = media.attributes.BANDWIDTH || Number.MAX_VALUE;
  return main.playlists.filter(playlist => {
    if (!isEnabled(playlist)) {
      return false;
    }

    return (playlist.attributes.BANDWIDTH || 0) < currentBandwidth;
  }).length === 0;
};
const playlistMatch = (a, b) => {
  // both playlits are null
  // or only one playlist is non-null
  // no match
  if (!a && !b || !a && b || a && !b) {
    return false;
  } // playlist objects are the same, match


  if (a === b) {
    return true;
  } // first try to use id as it should be the most
  // accurate


  if (a.id && b.id && a.id === b.id) {
    return true;
  } // next try to use reslovedUri as it should be the
  // second most accurate.


  if (a.resolvedUri && b.resolvedUri && a.resolvedUri === b.resolvedUri) {
    return true;
  } // finally try to use uri as it should be accurate
  // but might miss a few cases for relative uris


  if (a.uri && b.uri && a.uri === b.uri) {
    return true;
  }

  return false;
};

const someAudioVariant = function (main, callback) {
  const AUDIO = main && main.mediaGroups && main.mediaGroups.AUDIO || {};
  let found = false;

  for (const groupName in AUDIO) {
    for (const label in AUDIO[groupName]) {
      found = callback(AUDIO[groupName][label]);

      if (found) {
        break;
      }
    }

    if (found) {
      break;
    }
  }

  return !!found;
};

const isAudioOnly = main => {
  // we are audio only if we have no main playlists but do
  // have media group playlists.
  if (!main || !main.playlists || !main.playlists.length) {
    // without audio variants or playlists this
    // is not an audio only main.
    const found = someAudioVariant(main, variant => variant.playlists && variant.playlists.length || variant.uri);
    return found;
  } // if every playlist has only an audio codec it is audio only


  for (let i = 0; i < main.playlists.length; i++) {
    const playlist = main.playlists[i];
    const CODECS = playlist.attributes && playlist.attributes.CODECS; // all codecs are audio, this is an audio playlist.

    if (CODECS && CODECS.split(',').every(c => isAudioCodec(c))) {
      continue;
    } // playlist is in an audio group it is audio only


    const found = someAudioVariant(main, variant => playlistMatch(playlist, variant));

    if (found) {
      continue;
    } // if we make it here this playlist isn't audio and we
    // are not audio only


    return false;
  } // if we make it past every playlist without returning, then
  // this is an audio only playlist.


  return true;
}; // exports

var Playlist = {
  liveEdgeDelay,
  duration,
  seekable,
  getMediaInfoForTime,
  isEnabled,
  isDisabled,
  isExcluded,
  isIncompatible,
  playlistEnd,
  isAes,
  hasAttribute,
  estimateSegmentRequestTime,
  isLowestEnabledRendition,
  isAudioOnly,
  playlistMatch,
  segmentDurationWithParts
};

const {
  log
} = videojs;
const createPlaylistID = (index, uri) => {
  return `${index}-${uri}`;
}; // default function for creating a group id

const groupID = (type, group, label) => {
  return `placeholder-uri-${type}-${group}-${label}`;
};
/**
 * Parses a given m3u8 playlist
 *
 * @param {Function} [onwarn]
 *        a function to call when the parser triggers a warning event.
 * @param {Function} [oninfo]
 *        a function to call when the parser triggers an info event.
 * @param {string} manifestString
 *        The downloaded manifest string
 * @param {Object[]} [customTagParsers]
 *        An array of custom tag parsers for the m3u8-parser instance
 * @param {Object[]} [customTagMappers]
 *        An array of custom tag mappers for the m3u8-parser instance
 * @param {boolean} [llhls]
 *        Whether to keep ll-hls features in the manifest after parsing.
 * @return {Object}
 *         The manifest object
 */

const parseManifest = ({
  onwarn,
  oninfo,
  manifestString,
  customTagParsers = [],
  customTagMappers = [],
  llhls
}) => {
  const parser = new Parser();

  if (onwarn) {
    parser.on('warn', onwarn);
  }

  if (oninfo) {
    parser.on('info', oninfo);
  }

  customTagParsers.forEach(customParser => parser.addParser(customParser));
  customTagMappers.forEach(mapper => parser.addTagMapper(mapper));
  parser.push(manifestString);
  parser.end();
  const manifest = parser.manifest; // remove llhls features from the parsed manifest
  // if we don't want llhls support.

  if (!llhls) {
    ['preloadSegment', 'skip', 'serverControl', 'renditionReports', 'partInf', 'partTargetDuration'].forEach(function (k) {
      if (manifest.hasOwnProperty(k)) {
        delete manifest[k];
      }
    });

    if (manifest.segments) {
      manifest.segments.forEach(function (segment) {
        ['parts', 'preloadHints'].forEach(function (k) {
          if (segment.hasOwnProperty(k)) {
            delete segment[k];
          }
        });
      });
    }
  }

  if (!manifest.targetDuration) {
    let targetDuration = 10;

    if (manifest.segments && manifest.segments.length) {
      targetDuration = manifest.segments.reduce((acc, s) => Math.max(acc, s.duration), 0);
    }

    if (onwarn) {
      onwarn({
        message: `manifest has no targetDuration defaulting to ${targetDuration}`
      });
    }

    manifest.targetDuration = targetDuration;
  }

  const parts = getLastParts(manifest);

  if (parts.length && !manifest.partTargetDuration) {
    const partTargetDuration = parts.reduce((acc, p) => Math.max(acc, p.duration), 0);

    if (onwarn) {
      onwarn({
        message: `manifest has no partTargetDuration defaulting to ${partTargetDuration}`
      });
      log.error('LL-HLS manifest has parts but lacks required #EXT-X-PART-INF:PART-TARGET value. See https://datatracker.ietf.org/doc/html/draft-pantos-hls-rfc8216bis-09#section-4.4.3.7. Playback is not guaranteed.');
    }

    manifest.partTargetDuration = partTargetDuration;
  }

  return manifest;
};
/**
 * Loops through all supported media groups in main and calls the provided
 * callback for each group
 *
 * @param {Object} main
 *        The parsed main manifest object
 * @param {Function} callback
 *        Callback to call for each media group
 */

const forEachMediaGroup = (main, callback) => {
  if (!main.mediaGroups) {
    return;
  }

  ['AUDIO', 'SUBTITLES'].forEach(mediaType => {
    if (!main.mediaGroups[mediaType]) {
      return;
    }

    for (const groupKey in main.mediaGroups[mediaType]) {
      for (const labelKey in main.mediaGroups[mediaType][groupKey]) {
        const mediaProperties = main.mediaGroups[mediaType][groupKey][labelKey];
        callback(mediaProperties, mediaType, groupKey, labelKey);
      }
    }
  });
};
/**
 * Adds properties and attributes to the playlist to keep consistent functionality for
 * playlists throughout VHS.
 *
 * @param {Object} config
 *        Arguments object
 * @param {Object} config.playlist
 *        The media playlist
 * @param {string} [config.uri]
 *        The uri to the media playlist (if media playlist is not from within a main
 *        playlist)
 * @param {string} id
 *        ID to use for the playlist
 */

const setupMediaPlaylist = ({
  playlist,
  uri,
  id
}) => {
  playlist.id = id;
  playlist.playlistErrors_ = 0;

  if (uri) {
    // For media playlists, m3u8-parser does not have access to a URI, as HLS media
    // playlists do not contain their own source URI, but one is needed for consistency in
    // VHS.
    playlist.uri = uri;
  } // For HLS main playlists, even though certain attributes MUST be defined, the
  // stream may still be played without them.
  // For HLS media playlists, m3u8-parser does not attach an attributes object to the
  // manifest.
  //
  // To avoid undefined reference errors through the project, and make the code easier
  // to write/read, add an empty attributes object for these cases.


  playlist.attributes = playlist.attributes || {};
};
/**
 * Adds ID, resolvedUri, and attributes properties to each playlist of the main, where
 * necessary. In addition, creates playlist IDs for each playlist and adds playlist ID to
 * playlist references to the playlists array.
 *
 * @param {Object} main
 *        The main playlist
 */

const setupMediaPlaylists = main => {
  let i = main.playlists.length;

  while (i--) {
    const playlist = main.playlists[i];
    setupMediaPlaylist({
      playlist,
      id: createPlaylistID(i, playlist.uri)
    });
    playlist.resolvedUri = resolveUrl(main.uri, playlist.uri);
    main.playlists[playlist.id] = playlist; // URI reference added for backwards compatibility

    main.playlists[playlist.uri] = playlist; // Although the spec states an #EXT-X-STREAM-INF tag MUST have a BANDWIDTH attribute,
    // the stream can be played without it. Although an attributes property may have been
    // added to the playlist to prevent undefined references, issue a warning to fix the
    // manifest.

    if (!playlist.attributes.BANDWIDTH) {
      log.warn('Invalid playlist STREAM-INF detected. Missing BANDWIDTH attribute.');
    }
  }
};
/**
 * Adds resolvedUri properties to each media group.
 *
 * @param {Object} main
 *        The main playlist
 */

const resolveMediaGroupUris = main => {
  forEachMediaGroup(main, properties => {
    if (properties.uri) {
      properties.resolvedUri = resolveUrl(main.uri, properties.uri);
    }
  });
};
/**
 * Creates a main playlist wrapper to insert a sole media playlist into.
 *
 * @param {Object} media
 *        Media playlist
 * @param {string} uri
 *        The media URI
 *
 * @return {Object}
 *         main playlist
 */

const mainForMedia = (media, uri) => {
  const id = createPlaylistID(0, uri);
  const main = {
    mediaGroups: {
      'AUDIO': {},
      'VIDEO': {},
      'CLOSED-CAPTIONS': {},
      'SUBTITLES': {}
    },
    uri: window$1.location.href,
    resolvedUri: window$1.location.href,
    playlists: [{
      uri,
      id,
      resolvedUri: uri,
      // m3u8-parser does not attach an attributes property to media playlists so make
      // sure that the property is attached to avoid undefined reference errors
      attributes: {}
    }]
  }; // set up ID reference

  main.playlists[id] = main.playlists[0]; // URI reference added for backwards compatibility

  main.playlists[uri] = main.playlists[0];
  return main;
};
/**
 * Does an in-place update of the main manifest to add updated playlist URI references
 * as well as other properties needed by VHS that aren't included by the parser.
 *
 * @param {Object} main
 *        main manifest object
 * @param {string} uri
 *        The source URI
 * @param {function} createGroupID
 *        A function to determine how to create the groupID for mediaGroups
 */

const addPropertiesToMain = (main, uri, createGroupID = groupID) => {
  main.uri = uri;

  for (let i = 0; i < main.playlists.length; i++) {
    if (!main.playlists[i].uri) {
      // Set up phony URIs for the playlists since playlists are referenced by their URIs
      // throughout VHS, but some formats (e.g., DASH) don't have external URIs
      // TODO: consider adding dummy URIs in mpd-parser
      const phonyUri = `placeholder-uri-${i}`;
      main.playlists[i].uri = phonyUri;
    }
  }

  const audioOnlyMain = isAudioOnly(main);
  forEachMediaGroup(main, (properties, mediaType, groupKey, labelKey) => {
    // add a playlist array under properties
    if (!properties.playlists || !properties.playlists.length) {
      // If the manifest is audio only and this media group does not have a uri, check
      // if the media group is located in the main list of playlists. If it is, don't add
      // placeholder properties as it shouldn't be considered an alternate audio track.
      if (audioOnlyMain && mediaType === 'AUDIO' && !properties.uri) {
        for (let i = 0; i < main.playlists.length; i++) {
          const p = main.playlists[i];

          if (p.attributes && p.attributes.AUDIO && p.attributes.AUDIO === groupKey) {
            return;
          }
        }
      }

      properties.playlists = [_extends({}, properties)];
    }

    properties.playlists.forEach(function (p, i) {
      const groupId = createGroupID(mediaType, groupKey, labelKey, p);
      const id = createPlaylistID(i, groupId);

      if (p.uri) {
        p.resolvedUri = p.resolvedUri || resolveUrl(main.uri, p.uri);
      } else {
        // DEPRECATED, this has been added to prevent a breaking change.
        // previously we only ever had a single media group playlist, so
        // we mark the first playlist uri without prepending the index as we used to
        // ideally we would do all of the playlists the same way.
        p.uri = i === 0 ? groupId : id; // don't resolve a placeholder uri to an absolute url, just use
        // the placeholder again

        p.resolvedUri = p.uri;
      }

      p.id = p.id || id; // add an empty attributes object, all playlists are
      // expected to have this.

      p.attributes = p.attributes || {}; // setup ID and URI references (URI for backwards compatibility)

      main.playlists[p.id] = p;
      main.playlists[p.uri] = p;
    });
  });
  setupMediaPlaylists(main);
  resolveMediaGroupUris(main);
};

class DateRangesStorage {
  constructor() {
    this.offset_ = null;
    this.pendingDateRanges_ = new Map();
    this.processedDateRanges_ = new Map();
  }

  setOffset(segments = []) {
    // already set
    if (this.offset_ !== null) {
      return;
    } // no segment to process


    if (!segments.length) {
      return;
    }

    const [firstSegment] = segments; // no program date time

    if (firstSegment.programDateTime === undefined) {
      return;
    } // Set offset as ProgramDateTime for the very first segment of the very first playlist load:


    this.offset_ = firstSegment.programDateTime / 1000;
  }

  setPendingDateRanges(dateRanges = []) {
    if (!dateRanges.length) {
      return;
    }

    const [dateRange] = dateRanges;
    const startTime = dateRange.startDate.getTime();
    this.trimProcessedDateRanges_(startTime);
    this.pendingDateRanges_ = dateRanges.reduce((map, pendingDateRange) => {
      map.set(pendingDateRange.id, pendingDateRange);
      return map;
    }, new Map());
  }

  processDateRange(dateRange) {
    this.pendingDateRanges_.delete(dateRange.id);
    this.processedDateRanges_.set(dateRange.id, dateRange);
  }

  getDateRangesToProcess() {
    if (this.offset_ === null) {
      return [];
    }

    const dateRangeClasses = {};
    const dateRangesToProcess = [];
    this.pendingDateRanges_.forEach((dateRange, id) => {
      if (this.processedDateRanges_.has(id)) {
        return;
      }

      dateRange.startTime = dateRange.startDate.getTime() / 1000 - this.offset_;

      dateRange.processDateRange = () => this.processDateRange(dateRange);

      dateRangesToProcess.push(dateRange);

      if (!dateRange.class) {
        return;
      }

      if (dateRangeClasses[dateRange.class]) {
        const length = dateRangeClasses[dateRange.class].push(dateRange);
        dateRange.classListIndex = length - 1;
      } else {
        dateRangeClasses[dateRange.class] = [dateRange];
        dateRange.classListIndex = 0;
      }
    });

    for (const dateRange of dateRangesToProcess) {
      const classList = dateRangeClasses[dateRange.class] || [];

      if (dateRange.endDate) {
        dateRange.endTime = dateRange.endDate.getTime() / 1000 - this.offset_;
      } else if (dateRange.endOnNext && classList[dateRange.classListIndex + 1]) {
        dateRange.endTime = classList[dateRange.classListIndex + 1].startTime;
      } else if (dateRange.duration) {
        dateRange.endTime = dateRange.startTime + dateRange.duration;
      } else if (dateRange.plannedDuration) {
        dateRange.endTime = dateRange.startTime + dateRange.plannedDuration;
      } else {
        dateRange.endTime = dateRange.startTime;
      }
    }

    return dateRangesToProcess;
  }

  trimProcessedDateRanges_(startTime) {
    const copy = new Map(this.processedDateRanges_);
    copy.forEach((dateRange, id) => {
      if (dateRange.startDate.getTime() < startTime) {
        this.processedDateRanges_.delete(id);
      }
    });
  }

}

const {
  EventTarget: EventTarget$1
} = videojs;

const addLLHLSQueryDirectives = (uri, media) => {
  if (media.endList || !media.serverControl) {
    return uri;
  }

  const parameters = {};

  if (media.serverControl.canBlockReload) {
    const {
      preloadSegment
    } = media; // next msn is a zero based value, length is not.

    let nextMSN = media.mediaSequence + media.segments.length; // If preload segment has parts then it is likely
    // that we are going to request a part of that preload segment.
    // the logic below is used to determine that.

    if (preloadSegment) {
      const parts = preloadSegment.parts || []; // _HLS_part is a zero based index

      const nextPart = getKnownPartCount(media) - 1; // if nextPart is > -1 and not equal to just the
      // length of parts, then we know we had part preload hints
      // and we need to add the _HLS_part= query

      if (nextPart > -1 && nextPart !== parts.length - 1) {
        // add existing parts to our preload hints
        // eslint-disable-next-line
        parameters._HLS_part = nextPart;
      } // this if statement makes sure that we request the msn
      // of the preload segment if:
      // 1. the preload segment had parts (and was not yet a full segment)
      //    but was added to our segments array
      // 2. the preload segment had preload hints for parts that are not in
      //    the manifest yet.
      // in all other cases we want the segment after the preload segment
      // which will be given by using media.segments.length because it is 1 based
      // rather than 0 based.


      if (nextPart > -1 || parts.length) {
        nextMSN--;
      }
    } // add _HLS_msn= in front of any _HLS_part query
    // eslint-disable-next-line


    parameters._HLS_msn = nextMSN;
  }

  if (media.serverControl && media.serverControl.canSkipUntil) {
    // add _HLS_skip= infront of all other queries.
    // eslint-disable-next-line
    parameters._HLS_skip = media.serverControl.canSkipDateranges ? 'v2' : 'YES';
  }

  if (Object.keys(parameters).length) {
    const parsedUri = new window$1.URL(uri);
    ['_HLS_skip', '_HLS_msn', '_HLS_part'].forEach(function (name) {
      if (!parameters.hasOwnProperty(name)) {
        return;
      }

      parsedUri.searchParams.set(name, parameters[name]);
    });
    uri = parsedUri.toString();
  }

  return uri;
};
/**
 * Returns a new segment object with properties and
 * the parts array merged.
 *
 * @param {Object} a the old segment
 * @param {Object} b the new segment
 *
 * @return {Object} the merged segment
 */


const updateSegment = (a, b) => {
  if (!a) {
    return b;
  }

  const result = merge(a, b); // if only the old segment has preload hints
  // and the new one does not, remove preload hints.

  if (a.preloadHints && !b.preloadHints) {
    delete result.preloadHints;
  } // if only the old segment has parts
  // then the parts are no longer valid


  if (a.parts && !b.parts) {
    delete result.parts; // if both segments have parts
    // copy part propeties from the old segment
    // to the new one.
  } else if (a.parts && b.parts) {
    for (let i = 0; i < b.parts.length; i++) {
      if (a.parts && a.parts[i]) {
        result.parts[i] = merge(a.parts[i], b.parts[i]);
      }
    }
  } // set skipped to false for segments that have
  // have had information merged from the old segment.


  if (!a.skipped && b.skipped) {
    result.skipped = false;
  } // set preload to false for segments that have
  // had information added in the new segment.


  if (a.preload && !b.preload) {
    result.preload = false;
  }

  return result;
};
/**
 * Returns a new array of segments that is the result of merging
 * properties from an older list of segments onto an updated
 * list. No properties on the updated playlist will be ovewritten.
 *
 * @param {Array} original the outdated list of segments
 * @param {Array} update the updated list of segments
 * @param {number=} offset the index of the first update
 * segment in the original segment list. For non-live playlists,
 * this should always be zero and does not need to be
 * specified. For live playlists, it should be the difference
 * between the media sequence numbers in the original and updated
 * playlists.
 * @return {Array} a list of merged segment objects
 */

const updateSegments = (original, update, offset) => {
  const oldSegments = original.slice();
  const newSegments = update.slice();
  offset = offset || 0;
  const result = [];
  let currentMap;

  for (let newIndex = 0; newIndex < newSegments.length; newIndex++) {
    const oldSegment = oldSegments[newIndex + offset];
    const newSegment = newSegments[newIndex];

    if (oldSegment) {
      currentMap = oldSegment.map || currentMap;
      result.push(updateSegment(oldSegment, newSegment));
    } else {
      // carry over map to new segment if it is missing
      if (currentMap && !newSegment.map) {
        newSegment.map = currentMap;
      }

      result.push(newSegment);
    }
  }

  return result;
};
const resolveSegmentUris = (segment, baseUri) => {
  // preloadSegment will not have a uri at all
  // as the segment isn't actually in the manifest yet, only parts
  if (!segment.resolvedUri && segment.uri) {
    segment.resolvedUri = resolveUrl(baseUri, segment.uri);
  }

  if (segment.key && !segment.key.resolvedUri) {
    segment.key.resolvedUri = resolveUrl(baseUri, segment.key.uri);
  }

  if (segment.map && !segment.map.resolvedUri) {
    segment.map.resolvedUri = resolveUrl(baseUri, segment.map.uri);
  }

  if (segment.map && segment.map.key && !segment.map.key.resolvedUri) {
    segment.map.key.resolvedUri = resolveUrl(baseUri, segment.map.key.uri);
  }

  if (segment.parts && segment.parts.length) {
    segment.parts.forEach(p => {
      if (p.resolvedUri) {
        return;
      }

      p.resolvedUri = resolveUrl(baseUri, p.uri);
    });
  }

  if (segment.preloadHints && segment.preloadHints.length) {
    segment.preloadHints.forEach(p => {
      if (p.resolvedUri) {
        return;
      }

      p.resolvedUri = resolveUrl(baseUri, p.uri);
    });
  }
};

const getAllSegments = function (media) {
  const segments = media.segments || [];
  const preloadSegment = media.preloadSegment; // a preloadSegment with only preloadHints is not currently
  // a usable segment, only include a preloadSegment that has
  // parts.

  if (preloadSegment && preloadSegment.parts && preloadSegment.parts.length) {
    // if preloadHints has a MAP that means that the
    // init segment is going to change. We cannot use any of the parts
    // from this preload segment.
    if (preloadSegment.preloadHints) {
      for (let i = 0; i < preloadSegment.preloadHints.length; i++) {
        if (preloadSegment.preloadHints[i].type === 'MAP') {
          return segments;
        }
      }
    } // set the duration for our preload segment to target duration.


    preloadSegment.duration = media.targetDuration;
    preloadSegment.preload = true;
    segments.push(preloadSegment);
  }

  return segments;
}; // consider the playlist unchanged if the playlist object is the same or
// the number of segments is equal, the media sequence number is unchanged,
// and this playlist hasn't become the end of the playlist


const isPlaylistUnchanged = (a, b) => a === b || a.segments && b.segments && a.segments.length === b.segments.length && a.endList === b.endList && a.mediaSequence === b.mediaSequence && a.preloadSegment === b.preloadSegment;
/**
  * Returns a new main playlist that is the result of merging an
  * updated media playlist into the original version. If the
  * updated media playlist does not match any of the playlist
  * entries in the original main playlist, null is returned.
  *
  * @param {Object} main a parsed main M3U8 object
  * @param {Object} media a parsed media M3U8 object
  * @return {Object} a new object that represents the original
  * main playlist with the updated media playlist merged in, or
  * null if the merge produced no change.
  */

const updateMain$1 = (main, newMedia, unchangedCheck = isPlaylistUnchanged) => {
  const result = merge(main, {});
  const oldMedia = result.playlists[newMedia.id];

  if (!oldMedia) {
    return null;
  }

  if (unchangedCheck(oldMedia, newMedia)) {
    return null;
  }

  newMedia.segments = getAllSegments(newMedia);
  const mergedPlaylist = merge(oldMedia, newMedia); // always use the new media's preload segment

  if (mergedPlaylist.preloadSegment && !newMedia.preloadSegment) {
    delete mergedPlaylist.preloadSegment;
  } // if the update could overlap existing segment information, merge the two segment lists


  if (oldMedia.segments) {
    if (newMedia.skip) {
      newMedia.segments = newMedia.segments || []; // add back in objects for skipped segments, so that we merge
      // old properties into the new segments

      for (let i = 0; i < newMedia.skip.skippedSegments; i++) {
        newMedia.segments.unshift({
          skipped: true
        });
      }
    }

    mergedPlaylist.segments = updateSegments(oldMedia.segments, newMedia.segments, newMedia.mediaSequence - oldMedia.mediaSequence);
  } // resolve any segment URIs to prevent us from having to do it later


  mergedPlaylist.segments.forEach(segment => {
    resolveSegmentUris(segment, mergedPlaylist.resolvedUri);
  }); // TODO Right now in the playlists array there are two references to each playlist, one
  // that is referenced by index, and one by URI. The index reference may no longer be
  // necessary.

  for (let i = 0; i < result.playlists.length; i++) {
    if (result.playlists[i].id === newMedia.id) {
      result.playlists[i] = mergedPlaylist;
    }
  }

  result.playlists[newMedia.id] = mergedPlaylist; // URI reference added for backwards compatibility

  result.playlists[newMedia.uri] = mergedPlaylist; // update media group playlist references.

  forEachMediaGroup(main, (properties, mediaType, groupKey, labelKey) => {
    if (!properties.playlists) {
      return;
    }

    for (let i = 0; i < properties.playlists.length; i++) {
      if (newMedia.id === properties.playlists[i].id) {
        properties.playlists[i] = mergedPlaylist;
      }
    }
  });
  return result;
};
/**
 * Calculates the time to wait before refreshing a live playlist
 *
 * @param {Object} media
 *        The current media
 * @param {boolean} update
 *        True if there were any updates from the last refresh, false otherwise
 * @return {number}
 *         The time in ms to wait before refreshing the live playlist
 */

const refreshDelay = (media, update) => {
  const segments = media.segments || [];
  const lastSegment = segments[segments.length - 1];
  const lastPart = lastSegment && lastSegment.parts && lastSegment.parts[lastSegment.parts.length - 1];
  const lastDuration = lastPart && lastPart.duration || lastSegment && lastSegment.duration;

  if (update && lastDuration) {
    return lastDuration * 1000;
  } // if the playlist is unchanged since the last reload or last segment duration
  // cannot be determined, try again after half the target duration


  return (media.partTargetDuration || media.targetDuration || 10) * 500;
};
/**
 * Load a playlist from a remote location
 *
 * @class PlaylistLoader
 * @extends Stream
 * @param {string|Object} src url or object of manifest
 * @param {boolean} withCredentials the withCredentials xhr option
 * @class
 */

class PlaylistLoader extends EventTarget$1 {
  constructor(src, vhs, options = {}) {
    super();

    if (!src) {
      throw new Error('A non-empty playlist URL or object is required');
    }

    this.logger_ = logger('PlaylistLoader');
    const {
      withCredentials = false
    } = options;
    this.src = src;
    this.vhs_ = vhs;
    this.withCredentials = withCredentials;
    this.addDateRangesToTextTrack_ = options.addDateRangesToTextTrack;
    const vhsOptions = vhs.options_;
    this.customTagParsers = vhsOptions && vhsOptions.customTagParsers || [];
    this.customTagMappers = vhsOptions && vhsOptions.customTagMappers || [];
    this.llhls = vhsOptions && vhsOptions.llhls;
    this.dateRangesStorage_ = new DateRangesStorage(); // initialize the loader state

    this.state = 'HAVE_NOTHING'; // live playlist staleness timeout

    this.handleMediaupdatetimeout_ = this.handleMediaupdatetimeout_.bind(this);
    this.on('mediaupdatetimeout', this.handleMediaupdatetimeout_);
    this.on('loadedplaylist', this.handleLoadedPlaylist_.bind(this));
  }

  handleLoadedPlaylist_() {
    const mediaPlaylist = this.media();

    if (!mediaPlaylist) {
      return;
    }

    this.dateRangesStorage_.setOffset(mediaPlaylist.segments);
    this.dateRangesStorage_.setPendingDateRanges(mediaPlaylist.dateRanges);
    const availableDateRanges = this.dateRangesStorage_.getDateRangesToProcess();

    if (!availableDateRanges.length || !this.addDateRangesToTextTrack_) {
      return;
    }

    this.addDateRangesToTextTrack_(availableDateRanges);
  }

  handleMediaupdatetimeout_() {
    if (this.state !== 'HAVE_METADATA') {
      // only refresh the media playlist if no other activity is going on
      return;
    }

    const media = this.media();
    let uri = resolveUrl(this.main.uri, media.uri);

    if (this.llhls) {
      uri = addLLHLSQueryDirectives(uri, media);
    }

    this.state = 'HAVE_CURRENT_METADATA';
    this.request = this.vhs_.xhr({
      uri,
      withCredentials: this.withCredentials
    }, (error, req) => {
      // disposed
      if (!this.request) {
        return;
      }

      if (error) {
        return this.playlistRequestError(this.request, this.media(), 'HAVE_METADATA');
      }

      this.haveMetadata({
        playlistString: this.request.responseText,
        url: this.media().uri,
        id: this.media().id
      });
    });
  }

  playlistRequestError(xhr, playlist, startingState) {
    const {
      uri,
      id
    } = playlist; // any in-flight request is now finished

    this.request = null;

    if (startingState) {
      this.state = startingState;
    }

    this.error = {
      playlist: this.main.playlists[id],
      status: xhr.status,
      message: `HLS playlist request error at URL: ${uri}.`,
      responseText: xhr.responseText,
      code: xhr.status >= 500 ? 4 : 2
    };
    this.trigger('error');
  }

  parseManifest_({
    url,
    manifestString
  }) {
    return parseManifest({
      onwarn: ({
        message
      }) => this.logger_(`m3u8-parser warn for ${url}: ${message}`),
      oninfo: ({
        message
      }) => this.logger_(`m3u8-parser info for ${url}: ${message}`),
      manifestString,
      customTagParsers: this.customTagParsers,
      customTagMappers: this.customTagMappers,
      llhls: this.llhls
    });
  }
  /**
   * Update the playlist loader's state in response to a new or updated playlist.
   *
   * @param {string} [playlistString]
   *        Playlist string (if playlistObject is not provided)
   * @param {Object} [playlistObject]
   *        Playlist object (if playlistString is not provided)
   * @param {string} url
   *        URL of playlist
   * @param {string} id
   *        ID to use for playlist
   */


  haveMetadata({
    playlistString,
    playlistObject,
    url,
    id
  }) {
    // any in-flight request is now finished
    this.request = null;
    this.state = 'HAVE_METADATA';
    const playlist = playlistObject || this.parseManifest_({
      url,
      manifestString: playlistString
    });
    playlist.lastRequest = Date.now();
    setupMediaPlaylist({
      playlist,
      uri: url,
      id
    }); // merge this playlist into the main manifest

    const update = updateMain$1(this.main, playlist);
    this.targetDuration = playlist.partTargetDuration || playlist.targetDuration;
    this.pendingMedia_ = null;

    if (update) {
      this.main = update;
      this.media_ = this.main.playlists[id];
    } else {
      this.trigger('playlistunchanged');
    }

    this.updateMediaUpdateTimeout_(refreshDelay(this.media(), !!update));
    this.trigger('loadedplaylist');
  }
  /**
    * Abort any outstanding work and clean up.
    */


  dispose() {
    this.trigger('dispose');
    this.stopRequest();
    window$1.clearTimeout(this.mediaUpdateTimeout);
    window$1.clearTimeout(this.finalRenditionTimeout);
    this.dateRangesStorage_ = new DateRangesStorage();
    this.off();
  }

  stopRequest() {
    if (this.request) {
      const oldRequest = this.request;
      this.request = null;
      oldRequest.onreadystatechange = null;
      oldRequest.abort();
    }
  }
  /**
    * When called without any arguments, returns the currently
    * active media playlist. When called with a single argument,
    * triggers the playlist loader to asynchronously switch to the
    * specified media playlist. Calling this method while the
    * loader is in the HAVE_NOTHING causes an error to be emitted
    * but otherwise has no effect.
    *
    * @param {Object=} playlist the parsed media playlist
    * object to switch to
    * @param {boolean=} shouldDelay whether we should delay the request by half target duration
    *
    * @return {Playlist} the current loaded media
    */


  media(playlist, shouldDelay) {
    // getter
    if (!playlist) {
      return this.media_;
    } // setter


    if (this.state === 'HAVE_NOTHING') {
      throw new Error('Cannot switch media playlist from ' + this.state);
    } // find the playlist object if the target playlist has been
    // specified by URI


    if (typeof playlist === 'string') {
      if (!this.main.playlists[playlist]) {
        throw new Error('Unknown playlist URI: ' + playlist);
      }

      playlist = this.main.playlists[playlist];
    }

    window$1.clearTimeout(this.finalRenditionTimeout);

    if (shouldDelay) {
      const delay = (playlist.partTargetDuration || playlist.targetDuration) / 2 * 1000 || 5 * 1000;
      this.finalRenditionTimeout = window$1.setTimeout(this.media.bind(this, playlist, false), delay);
      return;
    }

    const startingState = this.state;
    const mediaChange = !this.media_ || playlist.id !== this.media_.id;
    const mainPlaylistRef = this.main.playlists[playlist.id]; // switch to fully loaded playlists immediately

    if (mainPlaylistRef && mainPlaylistRef.endList || // handle the case of a playlist object (e.g., if using vhs-json with a resolved
    // media playlist or, for the case of demuxed audio, a resolved audio media group)
    playlist.endList && playlist.segments.length) {
      // abort outstanding playlist requests
      if (this.request) {
        this.request.onreadystatechange = null;
        this.request.abort();
        this.request = null;
      }

      this.state = 'HAVE_METADATA';
      this.media_ = playlist; // trigger media change if the active media has been updated

      if (mediaChange) {
        this.trigger('mediachanging');

        if (startingState === 'HAVE_MAIN_MANIFEST') {
          // The initial playlist was a main manifest, and the first media selected was
          // also provided (in the form of a resolved playlist object) as part of the
          // source object (rather than just a URL). Therefore, since the media playlist
          // doesn't need to be requested, loadedmetadata won't trigger as part of the
          // normal flow, and needs an explicit trigger here.
          this.trigger('loadedmetadata');
        } else {
          this.trigger('mediachange');
        }
      }

      return;
    } // We update/set the timeout here so that live playlists
    // that are not a media change will "start" the loader as expected.
    // We expect that this function will start the media update timeout
    // cycle again. This also prevents a playlist switch failure from
    // causing us to stall during live.


    this.updateMediaUpdateTimeout_(refreshDelay(playlist, true)); // switching to the active playlist is a no-op

    if (!mediaChange) {
      return;
    }

    this.state = 'SWITCHING_MEDIA'; // there is already an outstanding playlist request

    if (this.request) {
      if (playlist.resolvedUri === this.request.url) {
        // requesting to switch to the same playlist multiple times
        // has no effect after the first
        return;
      }

      this.request.onreadystatechange = null;
      this.request.abort();
      this.request = null;
    } // request the new playlist


    if (this.media_) {
      this.trigger('mediachanging');
    }

    this.pendingMedia_ = playlist;
    this.request = this.vhs_.xhr({
      uri: playlist.resolvedUri,
      withCredentials: this.withCredentials
    }, (error, req) => {
      // disposed
      if (!this.request) {
        return;
      }

      playlist.lastRequest = Date.now();
      playlist.resolvedUri = resolveManifestRedirect(playlist.resolvedUri, req);

      if (error) {
        return this.playlistRequestError(this.request, playlist, startingState);
      }

      this.haveMetadata({
        playlistString: req.responseText,
        url: playlist.uri,
        id: playlist.id
      }); // fire loadedmetadata the first time a media playlist is loaded

      if (startingState === 'HAVE_MAIN_MANIFEST') {
        this.trigger('loadedmetadata');
      } else {
        this.trigger('mediachange');
      }
    });
  }
  /**
   * pause loading of the playlist
   */


  pause() {
    if (this.mediaUpdateTimeout) {
      window$1.clearTimeout(this.mediaUpdateTimeout);
      this.mediaUpdateTimeout = null;
    }

    this.stopRequest();

    if (this.state === 'HAVE_NOTHING') {
      // If we pause the loader before any data has been retrieved, its as if we never
      // started, so reset to an unstarted state.
      this.started = false;
    } // Need to restore state now that no activity is happening


    if (this.state === 'SWITCHING_MEDIA') {
      // if the loader was in the process of switching media, it should either return to
      // HAVE_MAIN_MANIFEST or HAVE_METADATA depending on if the loader has loaded a media
      // playlist yet. This is determined by the existence of loader.media_
      if (this.media_) {
        this.state = 'HAVE_METADATA';
      } else {
        this.state = 'HAVE_MAIN_MANIFEST';
      }
    } else if (this.state === 'HAVE_CURRENT_METADATA') {
      this.state = 'HAVE_METADATA';
    }
  }
  /**
   * start loading of the playlist
   */


  load(shouldDelay) {
    if (this.mediaUpdateTimeout) {
      window$1.clearTimeout(this.mediaUpdateTimeout);
      this.mediaUpdateTimeout = null;
    }

    const media = this.media();

    if (shouldDelay) {
      const delay = media ? (media.partTargetDuration || media.targetDuration) / 2 * 1000 : 5 * 1000;
      this.mediaUpdateTimeout = window$1.setTimeout(() => {
        this.mediaUpdateTimeout = null;
        this.load();
      }, delay);
      return;
    }

    if (!this.started) {
      this.start();
      return;
    }

    if (media && !media.endList) {
      this.trigger('mediaupdatetimeout');
    } else {
      this.trigger('loadedplaylist');
    }
  }

  updateMediaUpdateTimeout_(delay) {
    if (this.mediaUpdateTimeout) {
      window$1.clearTimeout(this.mediaUpdateTimeout);
      this.mediaUpdateTimeout = null;
    } // we only have use mediaupdatetimeout for live playlists.


    if (!this.media() || this.media().endList) {
      return;
    }

    this.mediaUpdateTimeout = window$1.setTimeout(() => {
      this.mediaUpdateTimeout = null;
      this.trigger('mediaupdatetimeout');
      this.updateMediaUpdateTimeout_(delay);
    }, delay);
  }
  /**
   * start loading of the playlist
   */


  start() {
    this.started = true;

    if (typeof this.src === 'object') {
      // in the case of an entirely constructed manifest object (meaning there's no actual
      // manifest on a server), default the uri to the page's href
      if (!this.src.uri) {
        this.src.uri = window$1.location.href;
      } // resolvedUri is added on internally after the initial request. Since there's no
      // request for pre-resolved manifests, add on resolvedUri here.


      this.src.resolvedUri = this.src.uri; // Since a manifest object was passed in as the source (instead of a URL), the first
      // request can be skipped (since the top level of the manifest, at a minimum, is
      // already available as a parsed manifest object). However, if the manifest object
      // represents a main playlist, some media playlists may need to be resolved before
      // the starting segment list is available. Therefore, go directly to setup of the
      // initial playlist, and let the normal flow continue from there.
      //
      // Note that the call to setup is asynchronous, as other sections of VHS may assume
      // that the first request is asynchronous.

      setTimeout(() => {
        this.setupInitialPlaylist(this.src);
      }, 0);
      return;
    } // request the specified URL


    this.request = this.vhs_.xhr({
      uri: this.src,
      withCredentials: this.withCredentials
    }, (error, req) => {
      // disposed
      if (!this.request) {
        return;
      } // clear the loader's request reference


      this.request = null;

      if (error) {
        this.error = {
          status: req.status,
          message: `HLS playlist request error at URL: ${this.src}.`,
          responseText: req.responseText,
          // MEDIA_ERR_NETWORK
          code: 2
        };

        if (this.state === 'HAVE_NOTHING') {
          this.started = false;
        }

        return this.trigger('error');
      }

      this.src = resolveManifestRedirect(this.src, req);
      const manifest = this.parseManifest_({
        manifestString: req.responseText,
        url: this.src
      });
      this.setupInitialPlaylist(manifest);
    });
  }

  srcUri() {
    return typeof this.src === 'string' ? this.src : this.src.uri;
  }
  /**
   * Given a manifest object that's either a main or media playlist, trigger the proper
   * events and set the state of the playlist loader.
   *
   * If the manifest object represents a main playlist, `loadedplaylist` will be
   * triggered to allow listeners to select a playlist. If none is selected, the loader
   * will default to the first one in the playlists array.
   *
   * If the manifest object represents a media playlist, `loadedplaylist` will be
   * triggered followed by `loadedmetadata`, as the only available playlist is loaded.
   *
   * In the case of a media playlist, a main playlist object wrapper with one playlist
   * will be created so that all logic can handle playlists in the same fashion (as an
   * assumed manifest object schema).
   *
   * @param {Object} manifest
   *        The parsed manifest object
   */


  setupInitialPlaylist(manifest) {
    this.state = 'HAVE_MAIN_MANIFEST';

    if (manifest.playlists) {
      this.main = manifest;
      addPropertiesToMain(this.main, this.srcUri()); // If the initial main playlist has playlists wtih segments already resolved,
      // then resolve URIs in advance, as they are usually done after a playlist request,
      // which may not happen if the playlist is resolved.

      manifest.playlists.forEach(playlist => {
        playlist.segments = getAllSegments(playlist);
        playlist.segments.forEach(segment => {
          resolveSegmentUris(segment, playlist.resolvedUri);
        });
      });
      this.trigger('loadedplaylist');

      if (!this.request) {
        // no media playlist was specifically selected so start
        // from the first listed one
        this.media(this.main.playlists[0]);
      }

      return;
    } // In order to support media playlists passed in as vhs-json, the case where the uri
    // is not provided as part of the manifest should be considered, and an appropriate
    // default used.


    const uri = this.srcUri() || window$1.location.href;
    this.main = mainForMedia(manifest, uri);
    this.haveMetadata({
      playlistObject: manifest,
      url: uri,
      id: this.main.playlists[0].id
    });
    this.trigger('loadedmetadata');
  }
  /**
   * Updates or deletes a preexisting pathway clone.
   * Ensures that all playlists related to the old pathway clone are
   * either updated or deleted.
   *
   * @param {Object} clone On update, the pathway clone object for the newly updated pathway clone.
   *        On delete, the old pathway clone object to be deleted.
   * @param {boolean} isUpdate True if the pathway is to be updated,
   *        false if it is meant to be deleted.
   */


  updateOrDeleteClone(clone, isUpdate) {
    const main = this.main;
    const pathway = clone.ID;
    let i = main.playlists.length; // Iterate backwards through the playlist so we can remove playlists if necessary.

    while (i--) {
      const p = main.playlists[i];

      if (p.attributes['PATHWAY-ID'] === pathway) {
        const oldPlaylistUri = p.resolvedUri;
        const oldPlaylistId = p.id; // update the indexed playlist and add new playlists by ID and URI

        if (isUpdate) {
          const newPlaylistUri = this.createCloneURI_(p.resolvedUri, clone);
          const newPlaylistId = createPlaylistID(pathway, newPlaylistUri);
          const attributes = this.createCloneAttributes_(pathway, p.attributes);
          const updatedPlaylist = this.createClonePlaylist_(p, newPlaylistId, clone, attributes);
          main.playlists[i] = updatedPlaylist;
          main.playlists[newPlaylistId] = updatedPlaylist;
          main.playlists[newPlaylistUri] = updatedPlaylist;
        } else {
          // Remove the indexed playlist.
          main.playlists.splice(i, 1);
        } // Remove playlists by the old ID and URI.


        delete main.playlists[oldPlaylistId];
        delete main.playlists[oldPlaylistUri];
      }
    }

    this.updateOrDeleteCloneMedia(clone, isUpdate);
  }
  /**
   * Updates or deletes media data based on the pathway clone object.
   * Due to the complexity of the media groups and playlists, in all cases
   * we remove all of the old media groups and playlists.
   * On updates, we then create new media groups and playlists based on the
   * new pathway clone object.
   *
   * @param {Object} clone The pathway clone object for the newly updated pathway clone.
   * @param {boolean} isUpdate True if the pathway is to be updated,
   *        false if it is meant to be deleted.
   */


  updateOrDeleteCloneMedia(clone, isUpdate) {
    const main = this.main;
    const id = clone.ID;
    ['AUDIO', 'SUBTITLES', 'CLOSED-CAPTIONS'].forEach(mediaType => {
      if (!main.mediaGroups[mediaType] || !main.mediaGroups[mediaType][id]) {
        return;
      }

      for (const groupKey in main.mediaGroups[mediaType]) {
        // Remove all media playlists for the media group for this pathway clone.
        if (groupKey === id) {
          for (const labelKey in main.mediaGroups[mediaType][groupKey]) {
            const oldMedia = main.mediaGroups[mediaType][groupKey][labelKey];
            oldMedia.playlists.forEach((p, i) => {
              const oldMediaPlaylist = main.playlists[p.id];
              const oldPlaylistId = oldMediaPlaylist.id;
              const oldPlaylistUri = oldMediaPlaylist.resolvedUri;
              delete main.playlists[oldPlaylistId];
              delete main.playlists[oldPlaylistUri];
            });
          } // Delete the old media group.


          delete main.mediaGroups[mediaType][groupKey];
        }
      }
    }); // Create the new media groups and playlists if there is an update.

    if (isUpdate) {
      this.createClonedMediaGroups_(clone);
    }
  }
  /**
   * Given a pathway clone object, clones all necessary playlists.
   *
   * @param {Object} clone The pathway clone object.
   * @param {Object} basePlaylist The original playlist to clone from.
   */


  addClonePathway(clone, basePlaylist = {}) {
    const main = this.main;
    const index = main.playlists.length;
    const uri = this.createCloneURI_(basePlaylist.resolvedUri, clone);
    const playlistId = createPlaylistID(clone.ID, uri);
    const attributes = this.createCloneAttributes_(clone.ID, basePlaylist.attributes);
    const playlist = this.createClonePlaylist_(basePlaylist, playlistId, clone, attributes);
    main.playlists[index] = playlist; // add playlist by ID and URI

    main.playlists[playlistId] = playlist;
    main.playlists[uri] = playlist;
    this.createClonedMediaGroups_(clone);
  }
  /**
   * Given a pathway clone object we create clones of all media.
   * In this function, all necessary information and updated playlists
   * are added to the `mediaGroup` object.
   * Playlists are also added to the `playlists` array so the media groups
   * will be properly linked.
   *
   * @param {Object} clone The pathway clone object.
   */


  createClonedMediaGroups_(clone) {
    const id = clone.ID;
    const baseID = clone['BASE-ID'];
    const main = this.main;
    ['AUDIO', 'SUBTITLES', 'CLOSED-CAPTIONS'].forEach(mediaType => {
      // If the media type doesn't exist, or there is already a clone, skip
      // to the next media type.
      if (!main.mediaGroups[mediaType] || main.mediaGroups[mediaType][id]) {
        return;
      }

      for (const groupKey in main.mediaGroups[mediaType]) {
        if (groupKey === baseID) {
          // Create the group.
          main.mediaGroups[mediaType][id] = {};
        } else {
          // There is no need to iterate over label keys in this case.
          continue;
        }

        for (const labelKey in main.mediaGroups[mediaType][groupKey]) {
          const oldMedia = main.mediaGroups[mediaType][groupKey][labelKey];
          main.mediaGroups[mediaType][id][labelKey] = _extends({}, oldMedia);
          const newMedia = main.mediaGroups[mediaType][id][labelKey]; // update URIs on the media

          const newUri = this.createCloneURI_(oldMedia.resolvedUri, clone);
          newMedia.resolvedUri = newUri;
          newMedia.uri = newUri; // Reset playlists in the new media group.

          newMedia.playlists = []; // Create new playlists in the newly cloned media group.

          oldMedia.playlists.forEach((p, i) => {
            const oldMediaPlaylist = main.playlists[p.id];
            const group = groupID(mediaType, id, labelKey);
            const newPlaylistID = createPlaylistID(id, group); // Check to see if it already exists

            if (oldMediaPlaylist && !main.playlists[newPlaylistID]) {
              const newMediaPlaylist = this.createClonePlaylist_(oldMediaPlaylist, newPlaylistID, clone);
              const newPlaylistUri = newMediaPlaylist.resolvedUri;
              main.playlists[newPlaylistID] = newMediaPlaylist;
              main.playlists[newPlaylistUri] = newMediaPlaylist;
            }

            newMedia.playlists[i] = this.createClonePlaylist_(p, newPlaylistID, clone);
          });
        }
      }
    });
  }
  /**
   * Using the original playlist to be cloned, and the pathway clone object
   * information, we create a new playlist.
   *
   * @param {Object} basePlaylist  The original playlist to be cloned from.
   * @param {string} id The desired id of the newly cloned playlist.
   * @param {Object} clone The pathway clone object.
   * @param {Object} attributes An optional object to populate the `attributes` property in the playlist.
   *
   * @return {Object} The combined cloned playlist.
   */


  createClonePlaylist_(basePlaylist, id, clone, attributes) {
    const uri = this.createCloneURI_(basePlaylist.resolvedUri, clone);
    const newProps = {
      resolvedUri: uri,
      uri,
      id
    }; // Remove all segments from previous playlist in the clone.

    if (basePlaylist.segments) {
      newProps.segments = [];
    }

    if (attributes) {
      newProps.attributes = attributes;
    }

    return merge(basePlaylist, newProps);
  }
  /**
   * Generates an updated URI for a cloned pathway based on the original
   * pathway's URI and the paramaters from the pathway clone object in the
   * content steering server response.
   *
   * @param {string} baseUri URI to be updated in the cloned pathway.
   * @param {Object} clone The pathway clone object.
   *
   * @return {string} The updated URI for the cloned pathway.
   */


  createCloneURI_(baseURI, clone) {
    const uri = new URL(baseURI);
    uri.hostname = clone['URI-REPLACEMENT'].HOST;
    const params = clone['URI-REPLACEMENT'].PARAMS; // Add params to the cloned URL.

    for (const key of Object.keys(params)) {
      uri.searchParams.set(key, params[key]);
    }

    return uri.href;
  }
  /**
   * Helper function to create the attributes needed for the new clone.
   * This mainly adds the necessary media attributes.
   *
   * @param {string} id The pathway clone object ID.
   * @param {Object} oldAttributes The old attributes to compare to.
   * @return {Object} The new attributes to add to the playlist.
   */


  createCloneAttributes_(id, oldAttributes) {
    const attributes = {
      ['PATHWAY-ID']: id
    };
    ['AUDIO', 'SUBTITLES', 'CLOSED-CAPTIONS'].forEach(mediaType => {
      if (oldAttributes[mediaType]) {
        attributes[mediaType] = id;
      }
    });
    return attributes;
  }
  /**
   * Returns the key ID set from a playlist
   *
   * @param {playlist} playlist to fetch the key ID set from.
   * @return a Set of 32 digit hex strings that represent the unique keyIds for that playlist.
   */


  getKeyIdSet(playlist) {
    if (playlist.contentProtection) {
      const keyIds = new Set();

      for (const keysystem in playlist.contentProtection) {
        const keyId = playlist.contentProtection[keysystem].attributes.keyId;

        if (keyId) {
          keyIds.add(keyId.toLowerCase());
        }
      }

      return keyIds;
    }
  }

}

/**
 * @file xhr.js
 */
const {
  xhr: videojsXHR
} = videojs;

const callbackWrapper = function (request, error, response, callback) {
  const reqResponse = request.responseType === 'arraybuffer' ? request.response : request.responseText;

  if (!error && reqResponse) {
    request.responseTime = Date.now();
    request.roundTripTime = request.responseTime - request.requestTime;
    request.bytesReceived = reqResponse.byteLength || reqResponse.length;

    if (!request.bandwidth) {
      request.bandwidth = Math.floor(request.bytesReceived / request.roundTripTime * 8 * 1000);
    }
  }

  if (response.headers) {
    request.responseHeaders = response.headers;
  } // videojs.xhr now uses a specific code on the error
  // object to signal that a request has timed out instead
  // of setting a boolean on the request object


  if (error && error.code === 'ETIMEDOUT') {
    request.timedout = true;
  } // videojs.xhr no longer considers status codes outside of 200 and 0
  // (for file uris) to be errors, but the old XHR did, so emulate that
  // behavior. Status 206 may be used in response to byterange requests.


  if (!error && !request.aborted && response.statusCode !== 200 && response.statusCode !== 206 && response.statusCode !== 0) {
    error = new Error('XHR Failed with a response of: ' + (request && (reqResponse || request.responseText)));
  }

  callback(error, request);
};
/**
 * Iterates over the request hooks Set and calls them in order
 *
 * @param {Set} hooks the hook Set to iterate over
 * @param {Object} options the request options to pass to the xhr wrapper
 * @return the callback hook function return value, the modified or new options Object.
 */


const callAllRequestHooks = (requestSet, options) => {
  if (!requestSet || !requestSet.size) {
    return;
  }

  let newOptions = options;
  requestSet.forEach(requestCallback => {
    newOptions = requestCallback(newOptions);
  });
  return newOptions;
};
/**
 * Iterates over the response hooks Set and calls them in order.
 *
 * @param {Set} hooks the hook Set to iterate over
 * @param {Object} request the xhr request object
 * @param {Object} error the xhr error object
 * @param {Object} response the xhr response object
 */


const callAllResponseHooks = (responseSet, request, error, response) => {
  if (!responseSet || !responseSet.size) {
    return;
  }

  responseSet.forEach(responseCallback => {
    responseCallback(request, error, response);
  });
};

const xhrFactory = function () {
  const xhr = function XhrFunction(options, callback) {
    // Add a default timeout
    options = merge({
      timeout: 45e3
    }, options); // Allow an optional user-specified function to modify the option
    // object before we construct the xhr request
    // TODO: Remove beforeRequest in the next major release.

    const beforeRequest = XhrFunction.beforeRequest || videojs.Vhs.xhr.beforeRequest; // onRequest and onResponse hooks as a Set, at either the player or global level.
    // TODO: new Set added here for beforeRequest alias. Remove this when beforeRequest is removed.

    const _requestCallbackSet = XhrFunction._requestCallbackSet || videojs.Vhs.xhr._requestCallbackSet || new Set();

    const _responseCallbackSet = XhrFunction._responseCallbackSet || videojs.Vhs.xhr._responseCallbackSet;

    if (beforeRequest && typeof beforeRequest === 'function') {
      videojs.log.warn('beforeRequest is deprecated, use onRequest instead.');

      _requestCallbackSet.add(beforeRequest);
    } // Use the standard videojs.xhr() method unless `videojs.Vhs.xhr` has been overriden
    // TODO: switch back to videojs.Vhs.xhr.name === 'XhrFunction' when we drop IE11


    const xhrMethod = videojs.Vhs.xhr.original === true ? videojsXHR : videojs.Vhs.xhr; // call all registered onRequest hooks, assign new options.

    const beforeRequestOptions = callAllRequestHooks(_requestCallbackSet, options); // Remove the beforeRequest function from the hooks set so stale beforeRequest functions are not called.

    _requestCallbackSet.delete(beforeRequest); // xhrMethod will call XMLHttpRequest.open and XMLHttpRequest.send


    const request = xhrMethod(beforeRequestOptions || options, function (error, response) {
      // call all registered onResponse hooks
      callAllResponseHooks(_responseCallbackSet, request, error, response);
      return callbackWrapper(request, error, response, callback);
    });
    const originalAbort = request.abort;

    request.abort = function () {
      request.aborted = true;
      return originalAbort.apply(request, arguments);
    };

    request.uri = options.uri;
    request.requestTime = Date.now();
    return request;
  };

  xhr.original = true;
  return xhr;
};
/**
 * Turns segment byterange into a string suitable for use in
 * HTTP Range requests
 *
 * @param {Object} byterange - an object with two values defining the start and end
 *                             of a byte-range
 */


const byterangeStr = function (byterange) {
  // `byterangeEnd` is one less than `offset + length` because the HTTP range
  // header uses inclusive ranges
  let byterangeEnd;
  const byterangeStart = byterange.offset;

  if (typeof byterange.offset === 'bigint' || typeof byterange.length === 'bigint') {
    byterangeEnd = window$1.BigInt(byterange.offset) + window$1.BigInt(byterange.length) - window$1.BigInt(1);
  } else {
    byterangeEnd = byterange.offset + byterange.length - 1;
  }

  return 'bytes=' + byterangeStart + '-' + byterangeEnd;
};
/**
 * Defines headers for use in the xhr request for a particular segment.
 *
 * @param {Object} segment - a simplified copy of the segmentInfo object
 *                           from SegmentLoader
 */

const segmentXhrHeaders = function (segment) {
  const headers = {};

  if (segment.byterange) {
    headers.Range = byterangeStr(segment.byterange);
  }

  return headers;
};

/**
 * @file bin-utils.js
 */

/**
 * convert a TimeRange to text
 *
 * @param {TimeRange} range the timerange to use for conversion
 * @param {number} i the iterator on the range to convert
 * @return {string} the range in string format
 */

const textRange = function (range, i) {
  return range.start(i) + '-' + range.end(i);
};
/**
 * format a number as hex string
 *
 * @param {number} e The number
 * @param {number} i the iterator
 * @return {string} the hex formatted number as a string
 */


const formatHexString = function (e, i) {
  const value = e.toString(16);
  return '00'.substring(0, 2 - value.length) + value + (i % 2 ? ' ' : '');
};

const formatAsciiString = function (e) {
  if (e >= 0x20 && e < 0x7e) {
    return String.fromCharCode(e);
  }

  return '.';
};
/**
 * Creates an object for sending to a web worker modifying properties that are TypedArrays
 * into a new object with seperated properties for the buffer, byteOffset, and byteLength.
 *
 * @param {Object} message
 *        Object of properties and values to send to the web worker
 * @return {Object}
 *         Modified message with TypedArray values expanded
 * @function createTransferableMessage
 */


const createTransferableMessage = function (message) {
  const transferable = {};
  Object.keys(message).forEach(key => {
    const value = message[key];

    if (isArrayBufferView(value)) {
      transferable[key] = {
        bytes: value.buffer,
        byteOffset: value.byteOffset,
        byteLength: value.byteLength
      };
    } else {
      transferable[key] = value;
    }
  });
  return transferable;
};
/**
 * Returns a unique string identifier for a media initialization
 * segment.
 *
 * @param {Object} initSegment
 *        the init segment object.
 *
 * @return {string} the generated init segment id
 */

const initSegmentId = function (initSegment) {
  const byterange = initSegment.byterange || {
    length: Infinity,
    offset: 0
  };
  return [byterange.length, byterange.offset, initSegment.resolvedUri].join(',');
};
/**
 * Returns a unique string identifier for a media segment key.
 *
 * @param {Object} key the encryption key
 * @return {string} the unique id for the media segment key.
 */

const segmentKeyId = function (key) {
  return key.resolvedUri;
};
/**
 * utils to help dump binary data to the console
 *
 * @param {Array|TypedArray} data
 *        data to dump to a string
 *
 * @return {string} the data as a hex string.
 */

const hexDump = data => {
  const bytes = Array.prototype.slice.call(data);
  const step = 16;
  let result = '';
  let hex;
  let ascii;

  for (let j = 0; j < bytes.length / step; j++) {
    hex = bytes.slice(j * step, j * step + step).map(formatHexString).join('');
    ascii = bytes.slice(j * step, j * step + step).map(formatAsciiString).join('');
    result += hex + ' ' + ascii + '\n';
  }

  return result;
};
const tagDump = ({
  bytes
}) => hexDump(bytes);
const textRanges = ranges => {
  let result = '';
  let i;

  for (i = 0; i < ranges.length; i++) {
    result += textRange(ranges, i) + ' ';
  }

  return result;
};

var utils = /*#__PURE__*/Object.freeze({
  __proto__: null,
  createTransferableMessage: createTransferableMessage,
  initSegmentId: initSegmentId,
  segmentKeyId: segmentKeyId,
  hexDump: hexDump,
  tagDump: tagDump,
  textRanges: textRanges
});

// TODO handle fmp4 case where the timing info is accurate and doesn't involve transmux
// 25% was arbitrarily chosen, and may need to be refined over time.

const SEGMENT_END_FUDGE_PERCENT = 0.25;
/**
 * Converts a player time (any time that can be gotten/set from player.currentTime(),
 * e.g., any time within player.seekable().start(0) to player.seekable().end(0)) to a
 * program time (any time referencing the real world (e.g., EXT-X-PROGRAM-DATE-TIME)).
 *
 * The containing segment is required as the EXT-X-PROGRAM-DATE-TIME serves as an "anchor
 * point" (a point where we have a mapping from program time to player time, with player
 * time being the post transmux start of the segment).
 *
 * For more details, see [this doc](../../docs/program-time-from-player-time.md).
 *
 * @param {number} playerTime the player time
 * @param {Object} segment the segment which contains the player time
 * @return {Date} program time
 */

const playerTimeToProgramTime = (playerTime, segment) => {
  if (!segment.dateTimeObject) {
    // Can't convert without an "anchor point" for the program time (i.e., a time that can
    // be used to map the start of a segment with a real world time).
    return null;
  }

  const transmuxerPrependedSeconds = segment.videoTimingInfo.transmuxerPrependedSeconds;
  const transmuxedStart = segment.videoTimingInfo.transmuxedPresentationStart; // get the start of the content from before old content is prepended

  const startOfSegment = transmuxedStart + transmuxerPrependedSeconds;
  const offsetFromSegmentStart = playerTime - startOfSegment;
  return new Date(segment.dateTimeObject.getTime() + offsetFromSegmentStart * 1000);
};
const originalSegmentVideoDuration = videoTimingInfo => {
  return videoTimingInfo.transmuxedPresentationEnd - videoTimingInfo.transmuxedPresentationStart - videoTimingInfo.transmuxerPrependedSeconds;
};
/**
 * Finds a segment that contains the time requested given as an ISO-8601 string. The
 * returned segment might be an estimate or an accurate match.
 *
 * @param {string} programTime The ISO-8601 programTime to find a match for
 * @param {Object} playlist A playlist object to search within
 */

const findSegmentForProgramTime = (programTime, playlist) => {
  // Assumptions:
  //  - verifyProgramDateTimeTags has already been run
  //  - live streams have been started
  let dateTimeObject;

  try {
    dateTimeObject = new Date(programTime);
  } catch (e) {
    return null;
  }

  if (!playlist || !playlist.segments || playlist.segments.length === 0) {
    return null;
  }

  let segment = playlist.segments[0];

  if (dateTimeObject < new Date(segment.dateTimeObject)) {
    // Requested time is before stream start.
    return null;
  }

  for (let i = 0; i < playlist.segments.length - 1; i++) {
    segment = playlist.segments[i];
    const nextSegmentStart = new Date(playlist.segments[i + 1].dateTimeObject);

    if (dateTimeObject < nextSegmentStart) {
      break;
    }
  }

  const lastSegment = playlist.segments[playlist.segments.length - 1];
  const lastSegmentStart = lastSegment.dateTimeObject;
  const lastSegmentDuration = lastSegment.videoTimingInfo ? originalSegmentVideoDuration(lastSegment.videoTimingInfo) : lastSegment.duration + lastSegment.duration * SEGMENT_END_FUDGE_PERCENT;
  const lastSegmentEnd = new Date(lastSegmentStart.getTime() + lastSegmentDuration * 1000);

  if (dateTimeObject > lastSegmentEnd) {
    // Beyond the end of the stream, or our best guess of the end of the stream.
    return null;
  }

  if (dateTimeObject > new Date(lastSegmentStart)) {
    segment = lastSegment;
  }

  return {
    segment,
    estimatedStart: segment.videoTimingInfo ? segment.videoTimingInfo.transmuxedPresentationStart : Playlist.duration(playlist, playlist.mediaSequence + playlist.segments.indexOf(segment)),
    // Although, given that all segments have accurate date time objects, the segment
    // selected should be accurate, unless the video has been transmuxed at some point
    // (determined by the presence of the videoTimingInfo object), the segment's "player
    // time" (the start time in the player) can't be considered accurate.
    type: segment.videoTimingInfo ? 'accurate' : 'estimate'
  };
};
/**
 * Finds a segment that contains the given player time(in seconds).
 *
 * @param {number} time The player time to find a match for
 * @param {Object} playlist A playlist object to search within
 */

const findSegmentForPlayerTime = (time, playlist) => {
  // Assumptions:
  // - there will always be a segment.duration
  // - we can start from zero
  // - segments are in time order
  if (!playlist || !playlist.segments || playlist.segments.length === 0) {
    return null;
  }

  let segmentEnd = 0;
  let segment;

  for (let i = 0; i < playlist.segments.length; i++) {
    segment = playlist.segments[i]; // videoTimingInfo is set after the segment is downloaded and transmuxed, and
    // should contain the most accurate values we have for the segment's player times.
    //
    // Use the accurate transmuxedPresentationEnd value if it is available, otherwise fall
    // back to an estimate based on the manifest derived (inaccurate) segment.duration, to
    // calculate an end value.

    segmentEnd = segment.videoTimingInfo ? segment.videoTimingInfo.transmuxedPresentationEnd : segmentEnd + segment.duration;

    if (time <= segmentEnd) {
      break;
    }
  }

  const lastSegment = playlist.segments[playlist.segments.length - 1];

  if (lastSegment.videoTimingInfo && lastSegment.videoTimingInfo.transmuxedPresentationEnd < time) {
    // The time requested is beyond the stream end.
    return null;
  }

  if (time > segmentEnd) {
    // The time is within or beyond the last segment.
    //
    // Check to see if the time is beyond a reasonable guess of the end of the stream.
    if (time > segmentEnd + lastSegment.duration * SEGMENT_END_FUDGE_PERCENT) {
      // Technically, because the duration value is only an estimate, the time may still
      // exist in the last segment, however, there isn't enough information to make even
      // a reasonable estimate.
      return null;
    }

    segment = lastSegment;
  }

  return {
    segment,
    estimatedStart: segment.videoTimingInfo ? segment.videoTimingInfo.transmuxedPresentationStart : segmentEnd - segment.duration,
    // Because videoTimingInfo is only set after transmux, it is the only way to get
    // accurate timing values.
    type: segment.videoTimingInfo ? 'accurate' : 'estimate'
  };
};
/**
 * Gives the offset of the comparisonTimestamp from the programTime timestamp in seconds.
 * If the offset returned is positive, the programTime occurs after the
 * comparisonTimestamp.
 * If the offset is negative, the programTime occurs before the comparisonTimestamp.
 *
 * @param {string} comparisonTimeStamp An ISO-8601 timestamp to compare against
 * @param {string} programTime The programTime as an ISO-8601 string
 * @return {number} offset
 */

const getOffsetFromTimestamp = (comparisonTimeStamp, programTime) => {
  let segmentDateTime;
  let programDateTime;

  try {
    segmentDateTime = new Date(comparisonTimeStamp);
    programDateTime = new Date(programTime);
  } catch (e) {// TODO handle error
  }

  const segmentTimeEpoch = segmentDateTime.getTime();
  const programTimeEpoch = programDateTime.getTime();
  return (programTimeEpoch - segmentTimeEpoch) / 1000;
};
/**
 * Checks that all segments in this playlist have programDateTime tags.
 *
 * @param {Object} playlist A playlist object
 */

const verifyProgramDateTimeTags = playlist => {
  if (!playlist.segments || playlist.segments.length === 0) {
    return false;
  }

  for (let i = 0; i < playlist.segments.length; i++) {
    const segment = playlist.segments[i];

    if (!segment.dateTimeObject) {
      return false;
    }
  }

  return true;
};
/**
 * Returns the programTime of the media given a playlist and a playerTime.
 * The playlist must have programDateTime tags for a programDateTime tag to be returned.
 * If the segments containing the time requested have not been buffered yet, an estimate
 * may be returned to the callback.
 *
 * @param {Object} args
 * @param {Object} args.playlist A playlist object to search within
 * @param {number} time A playerTime in seconds
 * @param {Function} callback(err, programTime)
 * @return {string} err.message A detailed error message
 * @return {Object} programTime
 * @return {number} programTime.mediaSeconds The streamTime in seconds
 * @return {string} programTime.programDateTime The programTime as an ISO-8601 String
 */

const getProgramTime = ({
  playlist,
  time = undefined,
  callback
}) => {
  if (!callback) {
    throw new Error('getProgramTime: callback must be provided');
  }

  if (!playlist || time === undefined) {
    return callback({
      message: 'getProgramTime: playlist and time must be provided'
    });
  }

  const matchedSegment = findSegmentForPlayerTime(time, playlist);

  if (!matchedSegment) {
    return callback({
      message: 'valid programTime was not found'
    });
  }

  if (matchedSegment.type === 'estimate') {
    return callback({
      message: 'Accurate programTime could not be determined.' + ' Please seek to e.seekTime and try again',
      seekTime: matchedSegment.estimatedStart
    });
  }

  const programTimeObject = {
    mediaSeconds: time
  };
  const programTime = playerTimeToProgramTime(time, matchedSegment.segment);

  if (programTime) {
    programTimeObject.programDateTime = programTime.toISOString();
  }

  return callback(null, programTimeObject);
};
/**
 * Seeks in the player to a time that matches the given programTime ISO-8601 string.
 *
 * @param {Object} args
 * @param {string} args.programTime A programTime to seek to as an ISO-8601 String
 * @param {Object} args.playlist A playlist to look within
 * @param {number} args.retryCount The number of times to try for an accurate seek. Default is 2.
 * @param {Function} args.seekTo A method to perform a seek
 * @param {boolean} args.pauseAfterSeek Whether to end in a paused state after seeking. Default is true.
 * @param {Object} args.tech The tech to seek on
 * @param {Function} args.callback(err, newTime) A callback to return the new time to
 * @return {string} err.message A detailed error message
 * @return {number} newTime The exact time that was seeked to in seconds
 */

const seekToProgramTime = ({
  programTime,
  playlist,
  retryCount = 2,
  seekTo,
  pauseAfterSeek = true,
  tech,
  callback
}) => {
  if (!callback) {
    throw new Error('seekToProgramTime: callback must be provided');
  }

  if (typeof programTime === 'undefined' || !playlist || !seekTo) {
    return callback({
      message: 'seekToProgramTime: programTime, seekTo and playlist must be provided'
    });
  }

  if (!playlist.endList && !tech.hasStarted_) {
    return callback({
      message: 'player must be playing a live stream to start buffering'
    });
  }

  if (!verifyProgramDateTimeTags(playlist)) {
    return callback({
      message: 'programDateTime tags must be provided in the manifest ' + playlist.resolvedUri
    });
  }

  const matchedSegment = findSegmentForProgramTime(programTime, playlist); // no match

  if (!matchedSegment) {
    return callback({
      message: `${programTime} was not found in the stream`
    });
  }

  const segment = matchedSegment.segment;
  const mediaOffset = getOffsetFromTimestamp(segment.dateTimeObject, programTime);

  if (matchedSegment.type === 'estimate') {
    // we've run out of retries
    if (retryCount === 0) {
      return callback({
        message: `${programTime} is not buffered yet. Try again`
      });
    }

    seekTo(matchedSegment.estimatedStart + mediaOffset);
    tech.one('seeked', () => {
      seekToProgramTime({
        programTime,
        playlist,
        retryCount: retryCount - 1,
        seekTo,
        pauseAfterSeek,
        tech,
        callback
      });
    });
    return;
  } // Since the segment.start value is determined from the buffered end or ending time
  // of the prior segment, the seekToTime doesn't need to account for any transmuxer
  // modifications.


  const seekToTime = segment.start + mediaOffset;

  const seekedCallback = () => {
    return callback(null, tech.currentTime());
  }; // listen for seeked event


  tech.one('seeked', seekedCallback); // pause before seeking as video.js will restore this state

  if (pauseAfterSeek) {
    tech.pause();
  }

  seekTo(seekToTime);
};

// which will only happen if the request is complete.

const callbackOnCompleted = (request, cb) => {
  if (request.readyState === 4) {
    return cb();
  }

  return;
};

const containerRequest = (uri, xhr, cb) => {
  let bytes = [];
  let id3Offset;
  let finished = false;

  const endRequestAndCallback = function (err, req, type, _bytes) {
    req.abort();
    finished = true;
    return cb(err, req, type, _bytes);
  };

  const progressListener = function (error, request) {
    if (finished) {
      return;
    }

    if (error) {
      return endRequestAndCallback(error, request, '', bytes);
    } // grap the new part of content that was just downloaded


    const newPart = request.responseText.substring(bytes && bytes.byteLength || 0, request.responseText.length); // add that onto bytes

    bytes = concatTypedArrays(bytes, stringToBytes(newPart, true));
    id3Offset = id3Offset || getId3Offset(bytes); // we need at least 10 bytes to determine a type
    // or we need at least two bytes after an id3Offset

    if (bytes.length < 10 || id3Offset && bytes.length < id3Offset + 2) {
      return callbackOnCompleted(request, () => endRequestAndCallback(error, request, '', bytes));
    }

    const type = detectContainerForBytes(bytes); // if this looks like a ts segment but we don't have enough data
    // to see the second sync byte, wait until we have enough data
    // before declaring it ts

    if (type === 'ts' && bytes.length < 188) {
      return callbackOnCompleted(request, () => endRequestAndCallback(error, request, '', bytes));
    } // this may be an unsynced ts segment
    // wait for 376 bytes before detecting no container


    if (!type && bytes.length < 376) {
      return callbackOnCompleted(request, () => endRequestAndCallback(error, request, '', bytes));
    }

    return endRequestAndCallback(null, request, type, bytes);
  };

  const options = {
    uri,

    beforeSend(request) {
      // this forces the browser to pass the bytes to us unprocessed
      request.overrideMimeType('text/plain; charset=x-user-defined');
      request.addEventListener('progress', function ({
        total,
        loaded
      }) {
        return callbackWrapper(request, null, {
          statusCode: request.status
        }, progressListener);
      });
    }

  };
  const request = xhr(options, function (error, response) {
    return callbackWrapper(request, error, response, progressListener);
  });
  return request;
};

const {
  EventTarget
} = videojs;

const dashPlaylistUnchanged = function (a, b) {
  if (!isPlaylistUnchanged(a, b)) {
    return false;
  } // for dash the above check will often return true in scenarios where
  // the playlist actually has changed because mediaSequence isn't a
  // dash thing, and we often set it to 1. So if the playlists have the same amount
  // of segments we return true.
  // So for dash we need to make sure that the underlying segments are different.
  // if sidx changed then the playlists are different.


  if (a.sidx && b.sidx && (a.sidx.offset !== b.sidx.offset || a.sidx.length !== b.sidx.length)) {
    return false;
  } else if (!a.sidx && b.sidx || a.sidx && !b.sidx) {
    return false;
  } // one or the other does not have segments
  // there was a change.


  if (a.segments && !b.segments || !a.segments && b.segments) {
    return false;
  } // neither has segments nothing changed


  if (!a.segments && !b.segments) {
    return true;
  } // check segments themselves


  for (let i = 0; i < a.segments.length; i++) {
    const aSegment = a.segments[i];
    const bSegment = b.segments[i]; // if uris are different between segments there was a change

    if (aSegment.uri !== bSegment.uri) {
      return false;
    } // neither segment has a byterange, there will be no byterange change.


    if (!aSegment.byterange && !bSegment.byterange) {
      continue;
    }

    const aByterange = aSegment.byterange;
    const bByterange = bSegment.byterange; // if byterange only exists on one of the segments, there was a change.

    if (aByterange && !bByterange || !aByterange && bByterange) {
      return false;
    } // if both segments have byterange with different offsets, there was a change.


    if (aByterange.offset !== bByterange.offset || aByterange.length !== bByterange.length) {
      return false;
    }
  } // if everything was the same with segments, this is the same playlist.


  return true;
};
/**
 * Use the representation IDs from the mpd object to create groupIDs, the NAME is set to mandatory representation
 * ID in the parser. This allows for continuous playout across periods with the same representation IDs
 * (continuous periods as defined in DASH-IF 3.2.12). This is assumed in the mpd-parser as well. If we want to support
 * periods without continuous playback this function may need modification as well as the parser.
 */


const dashGroupId = (type, group, label, playlist) => {
  // If the manifest somehow does not have an ID (non-dash compliant), use the label.
  const playlistId = playlist.attributes.NAME || label;
  return `placeholder-uri-${type}-${group}-${playlistId}`;
};
/**
 * Parses the main XML string and updates playlist URI references.
 *
 * @param {Object} config
 *        Object of arguments
 * @param {string} config.mainXml
 *        The mpd XML
 * @param {string} config.srcUrl
 *        The mpd URL
 * @param {Date} config.clientOffset
 *         A time difference between server and client
 * @param {Object} config.sidxMapping
 *        SIDX mappings for moof/mdat URIs and byte ranges
 * @return {Object}
 *         The parsed mpd manifest object
 */


const parseMainXml = ({
  mainXml,
  srcUrl,
  clientOffset,
  sidxMapping,
  previousManifest
}) => {
  const manifest = parse(mainXml, {
    manifestUri: srcUrl,
    clientOffset,
    sidxMapping,
    previousManifest
  });
  addPropertiesToMain(manifest, srcUrl, dashGroupId);
  return manifest;
};
/**
 * Removes any mediaGroup labels that no longer exist in the newMain
 *
 * @param {Object} update
 *         The previous mpd object being updated
 * @param {Object} newMain
 *         The new mpd object
 */

const removeOldMediaGroupLabels = (update, newMain) => {
  forEachMediaGroup(update, (properties, type, group, label) => {
    if (!(label in newMain.mediaGroups[type][group])) {
      delete update.mediaGroups[type][group][label];
    }
  });
};
/**
 * Returns a new main manifest that is the result of merging an updated main manifest
 * into the original version.
 *
 * @param {Object} oldMain
 *        The old parsed mpd object
 * @param {Object} newMain
 *        The updated parsed mpd object
 * @return {Object}
 *         A new object representing the original main manifest with the updated media
 *         playlists merged in
 */


const updateMain = (oldMain, newMain, sidxMapping) => {
  let noChanges = true;
  let update = merge(oldMain, {
    // These are top level properties that can be updated
    duration: newMain.duration,
    minimumUpdatePeriod: newMain.minimumUpdatePeriod,
    timelineStarts: newMain.timelineStarts
  }); // First update the playlists in playlist list

  for (let i = 0; i < newMain.playlists.length; i++) {
    const playlist = newMain.playlists[i];

    if (playlist.sidx) {
      const sidxKey = generateSidxKey(playlist.sidx); // add sidx segments to the playlist if we have all the sidx info already

      if (sidxMapping && sidxMapping[sidxKey] && sidxMapping[sidxKey].sidx) {
        addSidxSegmentsToPlaylist(playlist, sidxMapping[sidxKey].sidx, playlist.sidx.resolvedUri);
      }
    }

    const playlistUpdate = updateMain$1(update, playlist, dashPlaylistUnchanged);

    if (playlistUpdate) {
      update = playlistUpdate;
      noChanges = false;
    }
  } // Then update media group playlists


  forEachMediaGroup(newMain, (properties, type, group, label) => {
    if (properties.playlists && properties.playlists.length) {
      const id = properties.playlists[0].id;
      const playlistUpdate = updateMain$1(update, properties.playlists[0], dashPlaylistUnchanged);

      if (playlistUpdate) {
        update = playlistUpdate; // add new mediaGroup label if it doesn't exist and assign the new mediaGroup.

        if (!(label in update.mediaGroups[type][group])) {
          update.mediaGroups[type][group][label] = properties;
        } // update the playlist reference within media groups


        update.mediaGroups[type][group][label].playlists[0] = update.playlists[id];
        noChanges = false;
      }
    }
  }); // remove mediaGroup labels and references that no longer exist in the newMain

  removeOldMediaGroupLabels(update, newMain);

  if (newMain.minimumUpdatePeriod !== oldMain.minimumUpdatePeriod) {
    noChanges = false;
  }

  if (noChanges) {
    return null;
  }

  return update;
}; // SIDX should be equivalent if the URI and byteranges of the SIDX match.
// If the SIDXs have maps, the two maps should match,
// both `a` and `b` missing SIDXs is considered matching.
// If `a` or `b` but not both have a map, they aren't matching.

const equivalentSidx = (a, b) => {
  const neitherMap = Boolean(!a.map && !b.map);
  const equivalentMap = neitherMap || Boolean(a.map && b.map && a.map.byterange.offset === b.map.byterange.offset && a.map.byterange.length === b.map.byterange.length);
  return equivalentMap && a.uri === b.uri && a.byterange.offset === b.byterange.offset && a.byterange.length === b.byterange.length;
}; // exported for testing


const compareSidxEntry = (playlists, oldSidxMapping) => {
  const newSidxMapping = {};

  for (const id in playlists) {
    const playlist = playlists[id];
    const currentSidxInfo = playlist.sidx;

    if (currentSidxInfo) {
      const key = generateSidxKey(currentSidxInfo);

      if (!oldSidxMapping[key]) {
        break;
      }

      const savedSidxInfo = oldSidxMapping[key].sidxInfo;

      if (equivalentSidx(savedSidxInfo, currentSidxInfo)) {
        newSidxMapping[key] = oldSidxMapping[key];
      }
    }
  }

  return newSidxMapping;
};
/**
 *  A function that filters out changed items as they need to be requested separately.
 *
 *  The method is exported for testing
 *
 *  @param {Object} main the parsed mpd XML returned via mpd-parser
 *  @param {Object} oldSidxMapping the SIDX to compare against
 */

const filterChangedSidxMappings = (main, oldSidxMapping) => {
  const videoSidx = compareSidxEntry(main.playlists, oldSidxMapping);
  let mediaGroupSidx = videoSidx;
  forEachMediaGroup(main, (properties, mediaType, groupKey, labelKey) => {
    if (properties.playlists && properties.playlists.length) {
      const playlists = properties.playlists;
      mediaGroupSidx = merge(mediaGroupSidx, compareSidxEntry(playlists, oldSidxMapping));
    }
  });
  return mediaGroupSidx;
};
class DashPlaylistLoader extends EventTarget {
  // DashPlaylistLoader must accept either a src url or a playlist because subsequent
  // playlist loader setups from media groups will expect to be able to pass a playlist
  // (since there aren't external URLs to media playlists with DASH)
  constructor(srcUrlOrPlaylist, vhs, options = {}, mainPlaylistLoader) {
    super();
    this.mainPlaylistLoader_ = mainPlaylistLoader || this;

    if (!mainPlaylistLoader) {
      this.isMain_ = true;
    }

    const {
      withCredentials = false
    } = options;
    this.vhs_ = vhs;
    this.withCredentials = withCredentials;
    this.addMetadataToTextTrack = options.addMetadataToTextTrack;

    if (!srcUrlOrPlaylist) {
      throw new Error('A non-empty playlist URL or object is required');
    } // event naming?


    this.on('minimumUpdatePeriod', () => {
      this.refreshXml_();
    }); // live playlist staleness timeout

    this.on('mediaupdatetimeout', () => {
      this.refreshMedia_(this.media().id);
    });
    this.state = 'HAVE_NOTHING';
    this.loadedPlaylists_ = {};
    this.logger_ = logger('DashPlaylistLoader'); // initialize the loader state
    // The mainPlaylistLoader will be created with a string

    if (this.isMain_) {
      this.mainPlaylistLoader_.srcUrl = srcUrlOrPlaylist; // TODO: reset sidxMapping between period changes
      // once multi-period is refactored

      this.mainPlaylistLoader_.sidxMapping_ = {};
    } else {
      this.childPlaylist_ = srcUrlOrPlaylist;
    }
  }

  requestErrored_(err, request, startingState) {
    // disposed
    if (!this.request) {
      return true;
    } // pending request is cleared


    this.request = null;

    if (err) {
      // use the provided error object or create one
      // based on the request/response
      this.error = typeof err === 'object' && !(err instanceof Error) ? err : {
        status: request.status,
        message: 'DASH request error at URL: ' + request.uri,
        response: request.response,
        // MEDIA_ERR_NETWORK
        code: 2
      };

      if (startingState) {
        this.state = startingState;
      }

      this.trigger('error');
      return true;
    }
  }
  /**
   * Verify that the container of the sidx segment can be parsed
   * and if it can, get and parse that segment.
   */


  addSidxSegments_(playlist, startingState, cb) {
    const sidxKey = playlist.sidx && generateSidxKey(playlist.sidx); // playlist lacks sidx or sidx segments were added to this playlist already.

    if (!playlist.sidx || !sidxKey || this.mainPlaylistLoader_.sidxMapping_[sidxKey]) {
      // keep this function async
      this.mediaRequest_ = window$1.setTimeout(() => cb(false), 0);
      return;
    } // resolve the segment URL relative to the playlist


    const uri = resolveManifestRedirect(playlist.sidx.resolvedUri);

    const fin = (err, request) => {
      if (this.requestErrored_(err, request, startingState)) {
        return;
      }

      const sidxMapping = this.mainPlaylistLoader_.sidxMapping_;
      let sidx;

      try {
        sidx = parseSidx(toUint8(request.response).subarray(8));
      } catch (e) {
        // sidx parsing failed.
        this.requestErrored_(e, request, startingState);
        return;
      }

      sidxMapping[sidxKey] = {
        sidxInfo: playlist.sidx,
        sidx
      };
      addSidxSegmentsToPlaylist(playlist, sidx, playlist.sidx.resolvedUri);
      return cb(true);
    };

    this.request = containerRequest(uri, this.vhs_.xhr, (err, request, container, bytes) => {
      if (err) {
        return fin(err, request);
      }

      if (!container || container !== 'mp4') {
        return fin({
          status: request.status,
          message: `Unsupported ${container || 'unknown'} container type for sidx segment at URL: ${uri}`,
          // response is just bytes in this case
          // but we really don't want to return that.
          response: '',
          playlist,
          internal: true,
          playlistExclusionDuration: Infinity,
          // MEDIA_ERR_NETWORK
          code: 2
        }, request);
      } // if we already downloaded the sidx bytes in the container request, use them


      const {
        offset,
        length
      } = playlist.sidx.byterange;

      if (bytes.length >= length + offset) {
        return fin(err, {
          response: bytes.subarray(offset, offset + length),
          status: request.status,
          uri: request.uri
        });
      } // otherwise request sidx bytes


      this.request = this.vhs_.xhr({
        uri,
        responseType: 'arraybuffer',
        headers: segmentXhrHeaders({
          byterange: playlist.sidx.byterange
        })
      }, fin);
    });
  }

  dispose() {
    this.trigger('dispose');
    this.stopRequest();
    this.loadedPlaylists_ = {};
    window$1.clearTimeout(this.minimumUpdatePeriodTimeout_);
    window$1.clearTimeout(this.mediaRequest_);
    window$1.clearTimeout(this.mediaUpdateTimeout);
    this.mediaUpdateTimeout = null;
    this.mediaRequest_ = null;
    this.minimumUpdatePeriodTimeout_ = null;

    if (this.mainPlaylistLoader_.createMupOnMedia_) {
      this.off('loadedmetadata', this.mainPlaylistLoader_.createMupOnMedia_);
      this.mainPlaylistLoader_.createMupOnMedia_ = null;
    }

    this.off();
  }

  hasPendingRequest() {
    return this.request || this.mediaRequest_;
  }

  stopRequest() {
    if (this.request) {
      const oldRequest = this.request;
      this.request = null;
      oldRequest.onreadystatechange = null;
      oldRequest.abort();
    }
  }

  media(playlist) {
    // getter
    if (!playlist) {
      return this.media_;
    } // setter


    if (this.state === 'HAVE_NOTHING') {
      throw new Error('Cannot switch media playlist from ' + this.state);
    }

    const startingState = this.state; // find the playlist object if the target playlist has been specified by URI

    if (typeof playlist === 'string') {
      if (!this.mainPlaylistLoader_.main.playlists[playlist]) {
        throw new Error('Unknown playlist URI: ' + playlist);
      }

      playlist = this.mainPlaylistLoader_.main.playlists[playlist];
    }

    const mediaChange = !this.media_ || playlist.id !== this.media_.id; // switch to previously loaded playlists immediately

    if (mediaChange && this.loadedPlaylists_[playlist.id] && this.loadedPlaylists_[playlist.id].endList) {
      this.state = 'HAVE_METADATA';
      this.media_ = playlist; // trigger media change if the active media has been updated

      if (mediaChange) {
        this.trigger('mediachanging');
        this.trigger('mediachange');
      }

      return;
    } // switching to the active playlist is a no-op


    if (!mediaChange) {
      return;
    } // switching from an already loaded playlist


    if (this.media_) {
      this.trigger('mediachanging');
    }

    this.addSidxSegments_(playlist, startingState, sidxChanged => {
      // everything is ready just continue to haveMetadata
      this.haveMetadata({
        startingState,
        playlist
      });
    });
  }

  haveMetadata({
    startingState,
    playlist
  }) {
    this.state = 'HAVE_METADATA';
    this.loadedPlaylists_[playlist.id] = playlist;
    this.mediaRequest_ = null; // This will trigger loadedplaylist

    this.refreshMedia_(playlist.id); // fire loadedmetadata the first time a media playlist is loaded
    // to resolve setup of media groups

    if (startingState === 'HAVE_MAIN_MANIFEST') {
      this.trigger('loadedmetadata');
    } else {
      // trigger media change if the active media has been updated
      this.trigger('mediachange');
    }
  }

  pause() {
    if (this.mainPlaylistLoader_.createMupOnMedia_) {
      this.off('loadedmetadata', this.mainPlaylistLoader_.createMupOnMedia_);
      this.mainPlaylistLoader_.createMupOnMedia_ = null;
    }

    this.stopRequest();
    window$1.clearTimeout(this.mediaUpdateTimeout);
    this.mediaUpdateTimeout = null;

    if (this.isMain_) {
      window$1.clearTimeout(this.mainPlaylistLoader_.minimumUpdatePeriodTimeout_);
      this.mainPlaylistLoader_.minimumUpdatePeriodTimeout_ = null;
    }

    if (this.state === 'HAVE_NOTHING') {
      // If we pause the loader before any data has been retrieved, its as if we never
      // started, so reset to an unstarted state.
      this.started = false;
    }
  }

  load(isFinalRendition) {
    window$1.clearTimeout(this.mediaUpdateTimeout);
    this.mediaUpdateTimeout = null;
    const media = this.media();

    if (isFinalRendition) {
      const delay = media ? media.targetDuration / 2 * 1000 : 5 * 1000;
      this.mediaUpdateTimeout = window$1.setTimeout(() => this.load(), delay);
      return;
    } // because the playlists are internal to the manifest, load should either load the
    // main manifest, or do nothing but trigger an event


    if (!this.started) {
      this.start();
      return;
    }

    if (media && !media.endList) {
      // Check to see if this is the main loader and the MUP was cleared (this happens
      // when the loader was paused). `media` should be set at this point since one is always
      // set during `start()`.
      if (this.isMain_ && !this.minimumUpdatePeriodTimeout_) {
        // Trigger minimumUpdatePeriod to refresh the main manifest
        this.trigger('minimumUpdatePeriod'); // Since there was no prior minimumUpdatePeriodTimeout it should be recreated

        this.updateMinimumUpdatePeriodTimeout_();
      }

      this.trigger('mediaupdatetimeout');
    } else {
      this.trigger('loadedplaylist');
    }
  }

  start() {
    this.started = true; // We don't need to request the main manifest again
    // Call this asynchronously to match the xhr request behavior below

    if (!this.isMain_) {
      this.mediaRequest_ = window$1.setTimeout(() => this.haveMain_(), 0);
      return;
    }

    this.requestMain_((req, mainChanged) => {
      this.haveMain_();

      if (!this.hasPendingRequest() && !this.media_) {
        this.media(this.mainPlaylistLoader_.main.playlists[0]);
      }
    });
  }

  requestMain_(cb) {
    this.request = this.vhs_.xhr({
      uri: this.mainPlaylistLoader_.srcUrl,
      withCredentials: this.withCredentials
    }, (error, req) => {
      if (this.requestErrored_(error, req)) {
        if (this.state === 'HAVE_NOTHING') {
          this.started = false;
        }

        return;
      }

      const mainChanged = req.responseText !== this.mainPlaylistLoader_.mainXml_;
      this.mainPlaylistLoader_.mainXml_ = req.responseText;

      if (req.responseHeaders && req.responseHeaders.date) {
        this.mainLoaded_ = Date.parse(req.responseHeaders.date);
      } else {
        this.mainLoaded_ = Date.now();
      }

      this.mainPlaylistLoader_.srcUrl = resolveManifestRedirect(this.mainPlaylistLoader_.srcUrl, req);

      if (mainChanged) {
        this.handleMain_();
        this.syncClientServerClock_(() => {
          return cb(req, mainChanged);
        });
        return;
      }

      return cb(req, mainChanged);
    });
  }
  /**
   * Parses the main xml for UTCTiming node to sync the client clock to the server
   * clock. If the UTCTiming node requires a HEAD or GET request, that request is made.
   *
   * @param {Function} done
   *        Function to call when clock sync has completed
   */


  syncClientServerClock_(done) {
    const utcTiming = parseUTCTiming(this.mainPlaylistLoader_.mainXml_); // No UTCTiming element found in the mpd. Use Date header from mpd request as the
    // server clock

    if (utcTiming === null) {
      this.mainPlaylistLoader_.clientOffset_ = this.mainLoaded_ - Date.now();
      return done();
    }

    if (utcTiming.method === 'DIRECT') {
      this.mainPlaylistLoader_.clientOffset_ = utcTiming.value - Date.now();
      return done();
    }

    this.request = this.vhs_.xhr({
      uri: resolveUrl(this.mainPlaylistLoader_.srcUrl, utcTiming.value),
      method: utcTiming.method,
      withCredentials: this.withCredentials
    }, (error, req) => {
      // disposed
      if (!this.request) {
        return;
      }

      if (error) {
        // sync request failed, fall back to using date header from mpd
        // TODO: log warning
        this.mainPlaylistLoader_.clientOffset_ = this.mainLoaded_ - Date.now();
        return done();
      }

      let serverTime;

      if (utcTiming.method === 'HEAD') {
        if (!req.responseHeaders || !req.responseHeaders.date) {
          // expected date header not preset, fall back to using date header from mpd
          // TODO: log warning
          serverTime = this.mainLoaded_;
        } else {
          serverTime = Date.parse(req.responseHeaders.date);
        }
      } else {
        serverTime = Date.parse(req.responseText);
      }

      this.mainPlaylistLoader_.clientOffset_ = serverTime - Date.now();
      done();
    });
  }

  haveMain_() {
    this.state = 'HAVE_MAIN_MANIFEST';

    if (this.isMain_) {
      // We have the main playlist at this point, so
      // trigger this to allow PlaylistController
      // to make an initial playlist selection
      this.trigger('loadedplaylist');
    } else if (!this.media_) {
      // no media playlist was specifically selected so select
      // the one the child playlist loader was created with
      this.media(this.childPlaylist_);
    }
  }

  handleMain_() {
    // clear media request
    this.mediaRequest_ = null;
    const oldMain = this.mainPlaylistLoader_.main;
    let newMain = parseMainXml({
      mainXml: this.mainPlaylistLoader_.mainXml_,
      srcUrl: this.mainPlaylistLoader_.srcUrl,
      clientOffset: this.mainPlaylistLoader_.clientOffset_,
      sidxMapping: this.mainPlaylistLoader_.sidxMapping_,
      previousManifest: oldMain
    }); // if we have an old main to compare the new main against

    if (oldMain) {
      newMain = updateMain(oldMain, newMain, this.mainPlaylistLoader_.sidxMapping_);
    } // only update main if we have a new main


    this.mainPlaylistLoader_.main = newMain ? newMain : oldMain;
    const location = this.mainPlaylistLoader_.main.locations && this.mainPlaylistLoader_.main.locations[0];

    if (location && location !== this.mainPlaylistLoader_.srcUrl) {
      this.mainPlaylistLoader_.srcUrl = location;
    }

    if (!oldMain || newMain && newMain.minimumUpdatePeriod !== oldMain.minimumUpdatePeriod) {
      this.updateMinimumUpdatePeriodTimeout_();
    }

    this.addEventStreamToMetadataTrack_(newMain);
    return Boolean(newMain);
  }

  updateMinimumUpdatePeriodTimeout_() {
    const mpl = this.mainPlaylistLoader_; // cancel any pending creation of mup on media
    // a new one will be added if needed.

    if (mpl.createMupOnMedia_) {
      mpl.off('loadedmetadata', mpl.createMupOnMedia_);
      mpl.createMupOnMedia_ = null;
    } // clear any pending timeouts


    if (mpl.minimumUpdatePeriodTimeout_) {
      window$1.clearTimeout(mpl.minimumUpdatePeriodTimeout_);
      mpl.minimumUpdatePeriodTimeout_ = null;
    }

    let mup = mpl.main && mpl.main.minimumUpdatePeriod; // If the minimumUpdatePeriod has a value of 0, that indicates that the current
    // MPD has no future validity, so a new one will need to be acquired when new
    // media segments are to be made available. Thus, we use the target duration
    // in this case

    if (mup === 0) {
      if (mpl.media()) {
        mup = mpl.media().targetDuration * 1000;
      } else {
        mpl.createMupOnMedia_ = mpl.updateMinimumUpdatePeriodTimeout_;
        mpl.one('loadedmetadata', mpl.createMupOnMedia_);
      }
    } // if minimumUpdatePeriod is invalid or <= zero, which
    // can happen when a live video becomes VOD. skip timeout
    // creation.


    if (typeof mup !== 'number' || mup <= 0) {
      if (mup < 0) {
        this.logger_(`found invalid minimumUpdatePeriod of ${mup}, not setting a timeout`);
      }

      return;
    }

    this.createMUPTimeout_(mup);
  }

  createMUPTimeout_(mup) {
    const mpl = this.mainPlaylistLoader_;
    mpl.minimumUpdatePeriodTimeout_ = window$1.setTimeout(() => {
      mpl.minimumUpdatePeriodTimeout_ = null;
      mpl.trigger('minimumUpdatePeriod');
      mpl.createMUPTimeout_(mup);
    }, mup);
  }
  /**
   * Sends request to refresh the main xml and updates the parsed main manifest
   */


  refreshXml_() {
    this.requestMain_((req, mainChanged) => {
      if (!mainChanged) {
        return;
      }

      if (this.media_) {
        this.media_ = this.mainPlaylistLoader_.main.playlists[this.media_.id];
      } // This will filter out updated sidx info from the mapping


      this.mainPlaylistLoader_.sidxMapping_ = filterChangedSidxMappings(this.mainPlaylistLoader_.main, this.mainPlaylistLoader_.sidxMapping_);
      this.addSidxSegments_(this.media(), this.state, sidxChanged => {
        // TODO: do we need to reload the current playlist?
        this.refreshMedia_(this.media().id);
      });
    });
  }
  /**
   * Refreshes the media playlist by re-parsing the main xml and updating playlist
   * references. If this is an alternate loader, the updated parsed manifest is retrieved
   * from the main loader.
   */


  refreshMedia_(mediaID) {
    if (!mediaID) {
      throw new Error('refreshMedia_ must take a media id');
    } // for main we have to reparse the main xml
    // to re-create segments based on current timing values
    // which may change media. We only skip updating the main manifest
    // if this is the first time this.media_ is being set.
    // as main was just parsed in that case.


    if (this.media_ && this.isMain_) {
      this.handleMain_();
    }

    const playlists = this.mainPlaylistLoader_.main.playlists;
    const mediaChanged = !this.media_ || this.media_ !== playlists[mediaID];

    if (mediaChanged) {
      this.media_ = playlists[mediaID];
    } else {
      this.trigger('playlistunchanged');
    }

    if (!this.mediaUpdateTimeout) {
      const createMediaUpdateTimeout = () => {
        if (this.media().endList) {
          return;
        }

        this.mediaUpdateTimeout = window$1.setTimeout(() => {
          this.trigger('mediaupdatetimeout');
          createMediaUpdateTimeout();
        }, refreshDelay(this.media(), Boolean(mediaChanged)));
      };

      createMediaUpdateTimeout();
    }

    this.trigger('loadedplaylist');
  }
  /**
   * Takes eventstream data from a parsed DASH manifest and adds it to the metadata text track.
   *
   * @param {manifest} newMain the newly parsed manifest
   */


  addEventStreamToMetadataTrack_(newMain) {
    // Only add new event stream metadata if we have a new manifest.
    if (newMain && this.mainPlaylistLoader_.main.eventStream) {
      // convert EventStream to ID3-like data.
      const metadataArray = this.mainPlaylistLoader_.main.eventStream.map(eventStreamNode => {
        return {
          cueTime: eventStreamNode.start,
          frames: [{
            data: eventStreamNode.messageData
          }]
        };
      });
      this.addMetadataToTextTrack('EventStream', metadataArray, this.mainPlaylistLoader_.main.duration);
    }
  }
  /**
   * Returns the key ID set from a playlist
   *
   * @param {playlist} playlist to fetch the key ID set from.
   * @return a Set of 32 digit hex strings that represent the unique keyIds for that playlist.
   */


  getKeyIdSet(playlist) {
    if (playlist.contentProtection) {
      const keyIds = new Set();

      for (const keysystem in playlist.contentProtection) {
        const defaultKID = playlist.contentProtection[keysystem].attributes['cenc:default_KID'];

        if (defaultKID) {
          // DASH keyIds are separated by dashes.
          keyIds.add(defaultKID.replace(/-/g, '').toLowerCase());
        }
      }

      return keyIds;
    }
  }

}

var Config = {
  GOAL_BUFFER_LENGTH: 30,
  MAX_GOAL_BUFFER_LENGTH: 60,
  BACK_BUFFER_LENGTH: 30,
  GOAL_BUFFER_LENGTH_RATE: 1,
  // 0.5 MB/s
  INITIAL_BANDWIDTH: 4194304,
  // A fudge factor to apply to advertised playlist bitrates to account for
  // temporary flucations in client bandwidth
  BANDWIDTH_VARIANCE: 1.2,
  // How much of the buffer must be filled before we consider upswitching
  BUFFER_LOW_WATER_LINE: 0,
  MAX_BUFFER_LOW_WATER_LINE: 30,
  // TODO: Remove this when experimentalBufferBasedABR is removed
  EXPERIMENTAL_MAX_BUFFER_LOW_WATER_LINE: 16,
  BUFFER_LOW_WATER_LINE_RATE: 1,
  // If the buffer is greater than the high water line, we won't switch down
  BUFFER_HIGH_WATER_LINE: 30
};

const stringToArrayBuffer = string => {
  const view = new Uint8Array(new ArrayBuffer(string.length));

  for (let i = 0; i < string.length; i++) {
    view[i] = string.charCodeAt(i);
  }

  return view.buffer;
};

/* global Blob, BlobBuilder, Worker */
// unify worker interface
const browserWorkerPolyFill = function (workerObj) {
  // node only supports on/off
  workerObj.on = workerObj.addEventListener;
  workerObj.off = workerObj.removeEventListener;
  return workerObj;
};

const createObjectURL = function (str) {
  try {
    return URL.createObjectURL(new Blob([str], {
      type: 'application/javascript'
    }));
  } catch (e) {
    const blob = new BlobBuilder();
    blob.append(str);
    return URL.createObjectURL(blob.getBlob());
  }
};

const factory = function (code) {
  return function () {
    const objectUrl = createObjectURL(code);
    const worker = browserWorkerPolyFill(new Worker(objectUrl));
    worker.objURL = objectUrl;
    const terminate = worker.terminate;
    worker.on = worker.addEventListener;
    worker.off = worker.removeEventListener;

    worker.terminate = function () {
      URL.revokeObjectURL(objectUrl);
      return terminate.call(this);
    };

    return worker;
  };
};
const transform = function (code) {
  return `var browserWorkerPolyFill = ${browserWorkerPolyFill.toString()};\n` + 'browserWorkerPolyFill(self);\n' + code;
};

const getWorkerString = function (fn) {
  return fn.toString().replace(/^function.+?{/, '').slice(0, -1);
};

/* rollup-plugin-worker-factory start for worker!/home/runner/work/http-streaming/http-streaming/src/transmuxer-worker.js */
const workerCode$1 = transform(getWorkerString(function () {

  var commonjsGlobal = typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : {};
  /**
   * mux.js
   *
   * Copyright (c) Brightcove
   * Licensed Apache-2.0 https://github.com/videojs/mux.js/blob/master/LICENSE
   *
   * A lightweight readable stream implemention that handles event dispatching.
   * Objects that inherit from streams should call init in their constructors.
   */

  var Stream$8 = function () {
    this.init = function () {
      var listeners = {};
      /**
       * Add a listener for a specified event type.
       * @param type {string} the event name
       * @param listener {function} the callback to be invoked when an event of
       * the specified type occurs
       */

      this.on = function (type, listener) {
        if (!listeners[type]) {
          listeners[type] = [];
        }

        listeners[type] = listeners[type].concat(listener);
      };
      /**
       * Remove a listener for a specified event type.
       * @param type {string} the event name
       * @param listener {function} a function previously registered for this
       * type of event through `on`
       */


      this.off = function (type, listener) {
        var index;

        if (!listeners[type]) {
          return false;
        }

        index = listeners[type].indexOf(listener);
        listeners[type] = listeners[type].slice();
        listeners[type].splice(index, 1);
        return index > -1;
      };
      /**
       * Trigger an event of the specified type on this stream. Any additional
       * arguments to this function are passed as parameters to event listeners.
       * @param type {string} the event name
       */


      this.trigger = function (type) {
        var callbacks, i, length, args;
        callbacks = listeners[type];

        if (!callbacks) {
          return;
        } // Slicing the arguments on every invocation of this method
        // can add a significant amount of overhead. Avoid the
        // intermediate object creation for the common case of a
        // single callback argument


        if (arguments.length === 2) {
          length = callbacks.length;

          for (i = 0; i < length; ++i) {
            callbacks[i].call(this, arguments[1]);
          }
        } else {
          args = [];
          i = arguments.length;

          for (i = 1; i < arguments.length; ++i) {
            args.push(arguments[i]);
          }

          length = callbacks.length;

          for (i = 0; i < length; ++i) {
            callbacks[i].apply(this, args);
          }
        }
      };
      /**
       * Destroys the stream and cleans up.
       */


      this.dispose = function () {
        listeners = {};
      };
    };
  };
  /**
   * Forwards all `data` events on this stream to the destination stream. The
   * destination stream should provide a method `push` to receive the data
   * events as they arrive.
   * @param destination {stream} the stream that will receive all `data` events
   * @param autoFlush {boolean} if false, we will not call `flush` on the destination
   *                            when the current stream emits a 'done' event
   * @see http://nodejs.org/api/stream.html#stream_readable_pipe_destination_options
   */


  Stream$8.prototype.pipe = function (destination) {
    this.on('data', function (data) {
      destination.push(data);
    });
    this.on('done', function (flushSource) {
      destination.flush(flushSource);
    });
    this.on('partialdone', function (flushSource) {
      destination.partialFlush(flushSource);
    });
    this.on('endedtimeline', function (flushSource) {
      destination.endTimeline(flushSource);
    });
    this.on('reset', function (flushSource) {
      destination.reset(flushSource);
    });
    return destination;
  }; // Default stream functions that are expected to be overridden to perform
  // actual work. These are provided by the prototype as a sort of no-op
  // implementation so that we don't have to check for their existence in the
  // `pipe` function above.


  Stream$8.prototype.push = function (data) {
    this.trigger('data', data);
  };

  Stream$8.prototype.flush = function (flushSource) {
    this.trigger('done', flushSource);
  };

  Stream$8.prototype.partialFlush = function (flushSource) {
    this.trigger('partialdone', flushSource);
  };

  Stream$8.prototype.endTimeline = function (flushSource) {
    this.trigger('endedtimeline', flushSource);
  };

  Stream$8.prototype.reset = function (flushSource) {
    this.trigger('reset', flushSource);
  };

  var stream = Stream$8;
  var MAX_UINT32$1 = Math.pow(2, 32);

  var getUint64$3 = function (uint8) {
    var dv = new DataView(uint8.buffer, uint8.byteOffset, uint8.byteLength);
    var value;

    if (dv.getBigUint64) {
      value = dv.getBigUint64(0);

      if (value < Number.MAX_SAFE_INTEGER) {
        return Number(value);
      }

      return value;
    }

    return dv.getUint32(0) * MAX_UINT32$1 + dv.getUint32(4);
  };

  var numbers = {
    getUint64: getUint64$3,
    MAX_UINT32: MAX_UINT32$1
  };
  /**
   * mux.js
   *
   * Copyright (c) Brightcove
   * Licensed Apache-2.0 https://github.com/videojs/mux.js/blob/master/LICENSE
   *
   * Functions that generate fragmented MP4s suitable for use with Media
   * Source Extensions.
   */

  var MAX_UINT32 = numbers.MAX_UINT32;
  var box, dinf, esds, ftyp, mdat, mfhd, minf, moof, moov, mvex, mvhd, trak, tkhd, mdia, mdhd, hdlr, sdtp, stbl, stsd, traf, trex, trun$1, types, MAJOR_BRAND, MINOR_VERSION, AVC1_BRAND, VIDEO_HDLR, AUDIO_HDLR, HDLR_TYPES, VMHD, SMHD, DREF, STCO, STSC, STSZ, STTS; // pre-calculate constants

  (function () {
    var i;
    types = {
      avc1: [],
      // codingname
      avcC: [],
      btrt: [],
      dinf: [],
      dref: [],
      esds: [],
      ftyp: [],
      hdlr: [],
      mdat: [],
      mdhd: [],
      mdia: [],
      mfhd: [],
      minf: [],
      moof: [],
      moov: [],
      mp4a: [],
      // codingname
      mvex: [],
      mvhd: [],
      pasp: [],
      sdtp: [],
      smhd: [],
      stbl: [],
      stco: [],
      stsc: [],
      stsd: [],
      stsz: [],
      stts: [],
      styp: [],
      tfdt: [],
      tfhd: [],
      traf: [],
      trak: [],
      trun: [],
      trex: [],
      tkhd: [],
      vmhd: []
    }; // In environments where Uint8Array is undefined (e.g., IE8), skip set up so that we
    // don't throw an error

    if (typeof Uint8Array === 'undefined') {
      return;
    }

    for (i in types) {
      if (types.hasOwnProperty(i)) {
        types[i] = [i.charCodeAt(0), i.charCodeAt(1), i.charCodeAt(2), i.charCodeAt(3)];
      }
    }

    MAJOR_BRAND = new Uint8Array(['i'.charCodeAt(0), 's'.charCodeAt(0), 'o'.charCodeAt(0), 'm'.charCodeAt(0)]);
    AVC1_BRAND = new Uint8Array(['a'.charCodeAt(0), 'v'.charCodeAt(0), 'c'.charCodeAt(0), '1'.charCodeAt(0)]);
    MINOR_VERSION = new Uint8Array([0, 0, 0, 1]);
    VIDEO_HDLR = new Uint8Array([0x00, // version 0
    0x00, 0x00, 0x00, // flags
    0x00, 0x00, 0x00, 0x00, // pre_defined
    0x76, 0x69, 0x64, 0x65, // handler_type: 'vide'
    0x00, 0x00, 0x00, 0x00, // reserved
    0x00, 0x00, 0x00, 0x00, // reserved
    0x00, 0x00, 0x00, 0x00, // reserved
    0x56, 0x69, 0x64, 0x65, 0x6f, 0x48, 0x61, 0x6e, 0x64, 0x6c, 0x65, 0x72, 0x00 // name: 'VideoHandler'
    ]);
    AUDIO_HDLR = new Uint8Array([0x00, // version 0
    0x00, 0x00, 0x00, // flags
    0x00, 0x00, 0x00, 0x00, // pre_defined
    0x73, 0x6f, 0x75, 0x6e, // handler_type: 'soun'
    0x00, 0x00, 0x00, 0x00, // reserved
    0x00, 0x00, 0x00, 0x00, // reserved
    0x00, 0x00, 0x00, 0x00, // reserved
    0x53, 0x6f, 0x75, 0x6e, 0x64, 0x48, 0x61, 0x6e, 0x64, 0x6c, 0x65, 0x72, 0x00 // name: 'SoundHandler'
    ]);
    HDLR_TYPES = {
      video: VIDEO_HDLR,
      audio: AUDIO_HDLR
    };
    DREF = new Uint8Array([0x00, // version 0
    0x00, 0x00, 0x00, // flags
    0x00, 0x00, 0x00, 0x01, // entry_count
    0x00, 0x00, 0x00, 0x0c, // entry_size
    0x75, 0x72, 0x6c, 0x20, // 'url' type
    0x00, // version 0
    0x00, 0x00, 0x01 // entry_flags
    ]);
    SMHD = new Uint8Array([0x00, // version
    0x00, 0x00, 0x00, // flags
    0x00, 0x00, // balance, 0 means centered
    0x00, 0x00 // reserved
    ]);
    STCO = new Uint8Array([0x00, // version
    0x00, 0x00, 0x00, // flags
    0x00, 0x00, 0x00, 0x00 // entry_count
    ]);
    STSC = STCO;
    STSZ = new Uint8Array([0x00, // version
    0x00, 0x00, 0x00, // flags
    0x00, 0x00, 0x00, 0x00, // sample_size
    0x00, 0x00, 0x00, 0x00 // sample_count
    ]);
    STTS = STCO;
    VMHD = new Uint8Array([0x00, // version
    0x00, 0x00, 0x01, // flags
    0x00, 0x00, // graphicsmode
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00 // opcolor
    ]);
  })();

  box = function (type) {
    var payload = [],
        size = 0,
        i,
        result,
        view;

    for (i = 1; i < arguments.length; i++) {
      payload.push(arguments[i]);
    }

    i = payload.length; // calculate the total size we need to allocate

    while (i--) {
      size += payload[i].byteLength;
    }

    result = new Uint8Array(size + 8);
    view = new DataView(result.buffer, result.byteOffset, result.byteLength);
    view.setUint32(0, result.byteLength);
    result.set(type, 4); // copy the payload into the result

    for (i = 0, size = 8; i < payload.length; i++) {
      result.set(payload[i], size);
      size += payload[i].byteLength;
    }

    return result;
  };

  dinf = function () {
    return box(types.dinf, box(types.dref, DREF));
  };

  esds = function (track) {
    return box(types.esds, new Uint8Array([0x00, // version
    0x00, 0x00, 0x00, // flags
    // ES_Descriptor
    0x03, // tag, ES_DescrTag
    0x19, // length
    0x00, 0x00, // ES_ID
    0x00, // streamDependenceFlag, URL_flag, reserved, streamPriority
    // DecoderConfigDescriptor
    0x04, // tag, DecoderConfigDescrTag
    0x11, // length
    0x40, // object type
    0x15, // streamType
    0x00, 0x06, 0x00, // bufferSizeDB
    0x00, 0x00, 0xda, 0xc0, // maxBitrate
    0x00, 0x00, 0xda, 0xc0, // avgBitrate
    // DecoderSpecificInfo
    0x05, // tag, DecoderSpecificInfoTag
    0x02, // length
    // ISO/IEC 14496-3, AudioSpecificConfig
    // for samplingFrequencyIndex see ISO/IEC 13818-7:2006, 8.1.3.2.2, Table 35
    track.audioobjecttype << 3 | track.samplingfrequencyindex >>> 1, track.samplingfrequencyindex << 7 | track.channelcount << 3, 0x06, 0x01, 0x02 // GASpecificConfig
    ]));
  };

  ftyp = function () {
    return box(types.ftyp, MAJOR_BRAND, MINOR_VERSION, MAJOR_BRAND, AVC1_BRAND);
  };

  hdlr = function (type) {
    return box(types.hdlr, HDLR_TYPES[type]);
  };

  mdat = function (data) {
    return box(types.mdat, data);
  };

  mdhd = function (track) {
    var result = new Uint8Array([0x00, // version 0
    0x00, 0x00, 0x00, // flags
    0x00, 0x00, 0x00, 0x02, // creation_time
    0x00, 0x00, 0x00, 0x03, // modification_time
    0x00, 0x01, 0x5f, 0x90, // timescale, 90,000 "ticks" per second
    track.duration >>> 24 & 0xFF, track.duration >>> 16 & 0xFF, track.duration >>> 8 & 0xFF, track.duration & 0xFF, // duration
    0x55, 0xc4, // 'und' language (undetermined)
    0x00, 0x00]); // Use the sample rate from the track metadata, when it is
    // defined. The sample rate can be parsed out of an ADTS header, for
    // instance.

    if (track.samplerate) {
      result[12] = track.samplerate >>> 24 & 0xFF;
      result[13] = track.samplerate >>> 16 & 0xFF;
      result[14] = track.samplerate >>> 8 & 0xFF;
      result[15] = track.samplerate & 0xFF;
    }

    return box(types.mdhd, result);
  };

  mdia = function (track) {
    return box(types.mdia, mdhd(track), hdlr(track.type), minf(track));
  };

  mfhd = function (sequenceNumber) {
    return box(types.mfhd, new Uint8Array([0x00, 0x00, 0x00, 0x00, // flags
    (sequenceNumber & 0xFF000000) >> 24, (sequenceNumber & 0xFF0000) >> 16, (sequenceNumber & 0xFF00) >> 8, sequenceNumber & 0xFF // sequence_number
    ]));
  };

  minf = function (track) {
    return box(types.minf, track.type === 'video' ? box(types.vmhd, VMHD) : box(types.smhd, SMHD), dinf(), stbl(track));
  };

  moof = function (sequenceNumber, tracks) {
    var trackFragments = [],
        i = tracks.length; // build traf boxes for each track fragment

    while (i--) {
      trackFragments[i] = traf(tracks[i]);
    }

    return box.apply(null, [types.moof, mfhd(sequenceNumber)].concat(trackFragments));
  };
  /**
   * Returns a movie box.
   * @param tracks {array} the tracks associated with this movie
   * @see ISO/IEC 14496-12:2012(E), section 8.2.1
   */


  moov = function (tracks) {
    var i = tracks.length,
        boxes = [];

    while (i--) {
      boxes[i] = trak(tracks[i]);
    }

    return box.apply(null, [types.moov, mvhd(0xffffffff)].concat(boxes).concat(mvex(tracks)));
  };

  mvex = function (tracks) {
    var i = tracks.length,
        boxes = [];

    while (i--) {
      boxes[i] = trex(tracks[i]);
    }

    return box.apply(null, [types.mvex].concat(boxes));
  };

  mvhd = function (duration) {
    var bytes = new Uint8Array([0x00, // version 0
    0x00, 0x00, 0x00, // flags
    0x00, 0x00, 0x00, 0x01, // creation_time
    0x00, 0x00, 0x00, 0x02, // modification_time
    0x00, 0x01, 0x5f, 0x90, // timescale, 90,000 "ticks" per second
    (duration & 0xFF000000) >> 24, (duration & 0xFF0000) >> 16, (duration & 0xFF00) >> 8, duration & 0xFF, // duration
    0x00, 0x01, 0x00, 0x00, // 1.0 rate
    0x01, 0x00, // 1.0 volume
    0x00, 0x00, // reserved
    0x00, 0x00, 0x00, 0x00, // reserved
    0x00, 0x00, 0x00, 0x00, // reserved
    0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x40, 0x00, 0x00, 0x00, // transformation: unity matrix
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, // pre_defined
    0xff, 0xff, 0xff, 0xff // next_track_ID
    ]);
    return box(types.mvhd, bytes);
  };

  sdtp = function (track) {
    var samples = track.samples || [],
        bytes = new Uint8Array(4 + samples.length),
        flags,
        i; // leave the full box header (4 bytes) all zero
    // write the sample table

    for (i = 0; i < samples.length; i++) {
      flags = samples[i].flags;
      bytes[i + 4] = flags.dependsOn << 4 | flags.isDependedOn << 2 | flags.hasRedundancy;
    }

    return box(types.sdtp, bytes);
  };

  stbl = function (track) {
    return box(types.stbl, stsd(track), box(types.stts, STTS), box(types.stsc, STSC), box(types.stsz, STSZ), box(types.stco, STCO));
  };

  (function () {
    var videoSample, audioSample;

    stsd = function (track) {
      return box(types.stsd, new Uint8Array([0x00, // version 0
      0x00, 0x00, 0x00, // flags
      0x00, 0x00, 0x00, 0x01]), track.type === 'video' ? videoSample(track) : audioSample(track));
    };

    videoSample = function (track) {
      var sps = track.sps || [],
          pps = track.pps || [],
          sequenceParameterSets = [],
          pictureParameterSets = [],
          i,
          avc1Box; // assemble the SPSs

      for (i = 0; i < sps.length; i++) {
        sequenceParameterSets.push((sps[i].byteLength & 0xFF00) >>> 8);
        sequenceParameterSets.push(sps[i].byteLength & 0xFF); // sequenceParameterSetLength

        sequenceParameterSets = sequenceParameterSets.concat(Array.prototype.slice.call(sps[i])); // SPS
      } // assemble the PPSs


      for (i = 0; i < pps.length; i++) {
        pictureParameterSets.push((pps[i].byteLength & 0xFF00) >>> 8);
        pictureParameterSets.push(pps[i].byteLength & 0xFF);
        pictureParameterSets = pictureParameterSets.concat(Array.prototype.slice.call(pps[i]));
      }

      avc1Box = [types.avc1, new Uint8Array([0x00, 0x00, 0x00, 0x00, 0x00, 0x00, // reserved
      0x00, 0x01, // data_reference_index
      0x00, 0x00, // pre_defined
      0x00, 0x00, // reserved
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, // pre_defined
      (track.width & 0xff00) >> 8, track.width & 0xff, // width
      (track.height & 0xff00) >> 8, track.height & 0xff, // height
      0x00, 0x48, 0x00, 0x00, // horizresolution
      0x00, 0x48, 0x00, 0x00, // vertresolution
      0x00, 0x00, 0x00, 0x00, // reserved
      0x00, 0x01, // frame_count
      0x13, 0x76, 0x69, 0x64, 0x65, 0x6f, 0x6a, 0x73, 0x2d, 0x63, 0x6f, 0x6e, 0x74, 0x72, 0x69, 0x62, 0x2d, 0x68, 0x6c, 0x73, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, // compressorname
      0x00, 0x18, // depth = 24
      0x11, 0x11 // pre_defined = -1
      ]), box(types.avcC, new Uint8Array([0x01, // configurationVersion
      track.profileIdc, // AVCProfileIndication
      track.profileCompatibility, // profile_compatibility
      track.levelIdc, // AVCLevelIndication
      0xff // lengthSizeMinusOne, hard-coded to 4 bytes
      ].concat([sps.length], // numOfSequenceParameterSets
      sequenceParameterSets, // "SPS"
      [pps.length], // numOfPictureParameterSets
      pictureParameterSets // "PPS"
      ))), box(types.btrt, new Uint8Array([0x00, 0x1c, 0x9c, 0x80, // bufferSizeDB
      0x00, 0x2d, 0xc6, 0xc0, // maxBitrate
      0x00, 0x2d, 0xc6, 0xc0 // avgBitrate
      ]))];

      if (track.sarRatio) {
        var hSpacing = track.sarRatio[0],
            vSpacing = track.sarRatio[1];
        avc1Box.push(box(types.pasp, new Uint8Array([(hSpacing & 0xFF000000) >> 24, (hSpacing & 0xFF0000) >> 16, (hSpacing & 0xFF00) >> 8, hSpacing & 0xFF, (vSpacing & 0xFF000000) >> 24, (vSpacing & 0xFF0000) >> 16, (vSpacing & 0xFF00) >> 8, vSpacing & 0xFF])));
      }

      return box.apply(null, avc1Box);
    };

    audioSample = function (track) {
      return box(types.mp4a, new Uint8Array([// SampleEntry, ISO/IEC 14496-12
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, // reserved
      0x00, 0x01, // data_reference_index
      // AudioSampleEntry, ISO/IEC 14496-12
      0x00, 0x00, 0x00, 0x00, // reserved
      0x00, 0x00, 0x00, 0x00, // reserved
      (track.channelcount & 0xff00) >> 8, track.channelcount & 0xff, // channelcount
      (track.samplesize & 0xff00) >> 8, track.samplesize & 0xff, // samplesize
      0x00, 0x00, // pre_defined
      0x00, 0x00, // reserved
      (track.samplerate & 0xff00) >> 8, track.samplerate & 0xff, 0x00, 0x00 // samplerate, 16.16
      // MP4AudioSampleEntry, ISO/IEC 14496-14
      ]), esds(track));
    };
  })();

  tkhd = function (track) {
    var result = new Uint8Array([0x00, // version 0
    0x00, 0x00, 0x07, // flags
    0x00, 0x00, 0x00, 0x00, // creation_time
    0x00, 0x00, 0x00, 0x00, // modification_time
    (track.id & 0xFF000000) >> 24, (track.id & 0xFF0000) >> 16, (track.id & 0xFF00) >> 8, track.id & 0xFF, // track_ID
    0x00, 0x00, 0x00, 0x00, // reserved
    (track.duration & 0xFF000000) >> 24, (track.duration & 0xFF0000) >> 16, (track.duration & 0xFF00) >> 8, track.duration & 0xFF, // duration
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, // reserved
    0x00, 0x00, // layer
    0x00, 0x00, // alternate_group
    0x01, 0x00, // non-audio track volume
    0x00, 0x00, // reserved
    0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x40, 0x00, 0x00, 0x00, // transformation: unity matrix
    (track.width & 0xFF00) >> 8, track.width & 0xFF, 0x00, 0x00, // width
    (track.height & 0xFF00) >> 8, track.height & 0xFF, 0x00, 0x00 // height
    ]);
    return box(types.tkhd, result);
  };
  /**
   * Generate a track fragment (traf) box. A traf box collects metadata
   * about tracks in a movie fragment (moof) box.
   */


  traf = function (track) {
    var trackFragmentHeader, trackFragmentDecodeTime, trackFragmentRun, sampleDependencyTable, dataOffset, upperWordBaseMediaDecodeTime, lowerWordBaseMediaDecodeTime;
    trackFragmentHeader = box(types.tfhd, new Uint8Array([0x00, // version 0
    0x00, 0x00, 0x3a, // flags
    (track.id & 0xFF000000) >> 24, (track.id & 0xFF0000) >> 16, (track.id & 0xFF00) >> 8, track.id & 0xFF, // track_ID
    0x00, 0x00, 0x00, 0x01, // sample_description_index
    0x00, 0x00, 0x00, 0x00, // default_sample_duration
    0x00, 0x00, 0x00, 0x00, // default_sample_size
    0x00, 0x00, 0x00, 0x00 // default_sample_flags
    ]));
    upperWordBaseMediaDecodeTime = Math.floor(track.baseMediaDecodeTime / MAX_UINT32);
    lowerWordBaseMediaDecodeTime = Math.floor(track.baseMediaDecodeTime % MAX_UINT32);
    trackFragmentDecodeTime = box(types.tfdt, new Uint8Array([0x01, // version 1
    0x00, 0x00, 0x00, // flags
    // baseMediaDecodeTime
    upperWordBaseMediaDecodeTime >>> 24 & 0xFF, upperWordBaseMediaDecodeTime >>> 16 & 0xFF, upperWordBaseMediaDecodeTime >>> 8 & 0xFF, upperWordBaseMediaDecodeTime & 0xFF, lowerWordBaseMediaDecodeTime >>> 24 & 0xFF, lowerWordBaseMediaDecodeTime >>> 16 & 0xFF, lowerWordBaseMediaDecodeTime >>> 8 & 0xFF, lowerWordBaseMediaDecodeTime & 0xFF])); // the data offset specifies the number of bytes from the start of
    // the containing moof to the first payload byte of the associated
    // mdat

    dataOffset = 32 + // tfhd
    20 + // tfdt
    8 + // traf header
    16 + // mfhd
    8 + // moof header
    8; // mdat header
    // audio tracks require less metadata

    if (track.type === 'audio') {
      trackFragmentRun = trun$1(track, dataOffset);
      return box(types.traf, trackFragmentHeader, trackFragmentDecodeTime, trackFragmentRun);
    } // video tracks should contain an independent and disposable samples
    // box (sdtp)
    // generate one and adjust offsets to match


    sampleDependencyTable = sdtp(track);
    trackFragmentRun = trun$1(track, sampleDependencyTable.length + dataOffset);
    return box(types.traf, trackFragmentHeader, trackFragmentDecodeTime, trackFragmentRun, sampleDependencyTable);
  };
  /**
   * Generate a track box.
   * @param track {object} a track definition
   * @return {Uint8Array} the track box
   */


  trak = function (track) {
    track.duration = track.duration || 0xffffffff;
    return box(types.trak, tkhd(track), mdia(track));
  };

  trex = function (track) {
    var result = new Uint8Array([0x00, // version 0
    0x00, 0x00, 0x00, // flags
    (track.id & 0xFF000000) >> 24, (track.id & 0xFF0000) >> 16, (track.id & 0xFF00) >> 8, track.id & 0xFF, // track_ID
    0x00, 0x00, 0x00, 0x01, // default_sample_description_index
    0x00, 0x00, 0x00, 0x00, // default_sample_duration
    0x00, 0x00, 0x00, 0x00, // default_sample_size
    0x00, 0x01, 0x00, 0x01 // default_sample_flags
    ]); // the last two bytes of default_sample_flags is the sample
    // degradation priority, a hint about the importance of this sample
    // relative to others. Lower the degradation priority for all sample
    // types other than video.

    if (track.type !== 'video') {
      result[result.length - 1] = 0x00;
    }

    return box(types.trex, result);
  };

  (function () {
    var audioTrun, videoTrun, trunHeader; // This method assumes all samples are uniform. That is, if a
    // duration is present for the first sample, it will be present for
    // all subsequent samples.
    // see ISO/IEC 14496-12:2012, Section 8.8.8.1

    trunHeader = function (samples, offset) {
      var durationPresent = 0,
          sizePresent = 0,
          flagsPresent = 0,
          compositionTimeOffset = 0; // trun flag constants

      if (samples.length) {
        if (samples[0].duration !== undefined) {
          durationPresent = 0x1;
        }

        if (samples[0].size !== undefined) {
          sizePresent = 0x2;
        }

        if (samples[0].flags !== undefined) {
          flagsPresent = 0x4;
        }

        if (samples[0].compositionTimeOffset !== undefined) {
          compositionTimeOffset = 0x8;
        }
      }

      return [0x00, // version 0
      0x00, durationPresent | sizePresent | flagsPresent | compositionTimeOffset, 0x01, // flags
      (samples.length & 0xFF000000) >>> 24, (samples.length & 0xFF0000) >>> 16, (samples.length & 0xFF00) >>> 8, samples.length & 0xFF, // sample_count
      (offset & 0xFF000000) >>> 24, (offset & 0xFF0000) >>> 16, (offset & 0xFF00) >>> 8, offset & 0xFF // data_offset
      ];
    };

    videoTrun = function (track, offset) {
      var bytesOffest, bytes, header, samples, sample, i;
      samples = track.samples || [];
      offset += 8 + 12 + 16 * samples.length;
      header = trunHeader(samples, offset);
      bytes = new Uint8Array(header.length + samples.length * 16);
      bytes.set(header);
      bytesOffest = header.length;

      for (i = 0; i < samples.length; i++) {
        sample = samples[i];
        bytes[bytesOffest++] = (sample.duration & 0xFF000000) >>> 24;
        bytes[bytesOffest++] = (sample.duration & 0xFF0000) >>> 16;
        bytes[bytesOffest++] = (sample.duration & 0xFF00) >>> 8;
        bytes[bytesOffest++] = sample.duration & 0xFF; // sample_duration

        bytes[bytesOffest++] = (sample.size & 0xFF000000) >>> 24;
        bytes[bytesOffest++] = (sample.size & 0xFF0000) >>> 16;
        bytes[bytesOffest++] = (sample.size & 0xFF00) >>> 8;
        bytes[bytesOffest++] = sample.size & 0xFF; // sample_size

        bytes[bytesOffest++] = sample.flags.isLeading << 2 | sample.flags.dependsOn;
        bytes[bytesOffest++] = sample.flags.isDependedOn << 6 | sample.flags.hasRedundancy << 4 | sample.flags.paddingValue << 1 | sample.flags.isNonSyncSample;
        bytes[bytesOffest++] = sample.flags.degradationPriority & 0xF0 << 8;
        bytes[bytesOffest++] = sample.flags.degradationPriority & 0x0F; // sample_flags

        bytes[bytesOffest++] = (sample.compositionTimeOffset & 0xFF000000) >>> 24;
        bytes[bytesOffest++] = (sample.compositionTimeOffset & 0xFF0000) >>> 16;
        bytes[bytesOffest++] = (sample.compositionTimeOffset & 0xFF00) >>> 8;
        bytes[bytesOffest++] = sample.compositionTimeOffset & 0xFF; // sample_composition_time_offset
      }

      return box(types.trun, bytes);
    };

    audioTrun = function (track, offset) {
      var bytes, bytesOffest, header, samples, sample, i;
      samples = track.samples || [];
      offset += 8 + 12 + 8 * samples.length;
      header = trunHeader(samples, offset);
      bytes = new Uint8Array(header.length + samples.length * 8);
      bytes.set(header);
      bytesOffest = header.length;

      for (i = 0; i < samples.length; i++) {
        sample = samples[i];
        bytes[bytesOffest++] = (sample.duration & 0xFF000000) >>> 24;
        bytes[bytesOffest++] = (sample.duration & 0xFF0000) >>> 16;
        bytes[bytesOffest++] = (sample.duration & 0xFF00) >>> 8;
        bytes[bytesOffest++] = sample.duration & 0xFF; // sample_duration

        bytes[bytesOffest++] = (sample.size & 0xFF000000) >>> 24;
        bytes[bytesOffest++] = (sample.size & 0xFF0000) >>> 16;
        bytes[bytesOffest++] = (sample.size & 0xFF00) >>> 8;
        bytes[bytesOffest++] = sample.size & 0xFF; // sample_size
      }

      return box(types.trun, bytes);
    };

    trun$1 = function (track, offset) {
      if (track.type === 'audio') {
        return audioTrun(track, offset);
      }

      return videoTrun(track, offset);
    };
  })();

  var mp4Generator = {
    ftyp: ftyp,
    mdat: mdat,
    moof: moof,
    moov: moov,
    initSegment: function (tracks) {
      var fileType = ftyp(),
          movie = moov(tracks),
          result;
      result = new Uint8Array(fileType.byteLength + movie.byteLength);
      result.set(fileType);
      result.set(movie, fileType.byteLength);
      return result;
    }
  };
  /**
   * mux.js
   *
   * Copyright (c) Brightcove
   * Licensed Apache-2.0 https://github.com/videojs/mux.js/blob/master/LICENSE
   */
  // composed of the nal units that make up that frame
  // Also keep track of cummulative data about the frame from the nal units such
  // as the frame duration, starting pts, etc.

  var groupNalsIntoFrames = function (nalUnits) {
    var i,
        currentNal,
        currentFrame = [],
        frames = []; // TODO added for LHLS, make sure this is OK

    frames.byteLength = 0;
    frames.nalCount = 0;
    frames.duration = 0;
    currentFrame.byteLength = 0;

    for (i = 0; i < nalUnits.length; i++) {
      currentNal = nalUnits[i]; // Split on 'aud'-type nal units

      if (currentNal.nalUnitType === 'access_unit_delimiter_rbsp') {
        // Since the very first nal unit is expected to be an AUD
        // only push to the frames array when currentFrame is not empty
        if (currentFrame.length) {
          currentFrame.duration = currentNal.dts - currentFrame.dts; // TODO added for LHLS, make sure this is OK

          frames.byteLength += currentFrame.byteLength;
          frames.nalCount += currentFrame.length;
          frames.duration += currentFrame.duration;
          frames.push(currentFrame);
        }

        currentFrame = [currentNal];
        currentFrame.byteLength = currentNal.data.byteLength;
        currentFrame.pts = currentNal.pts;
        currentFrame.dts = currentNal.dts;
      } else {
        // Specifically flag key frames for ease of use later
        if (currentNal.nalUnitType === 'slice_layer_without_partitioning_rbsp_idr') {
          currentFrame.keyFrame = true;
        }

        currentFrame.duration = currentNal.dts - currentFrame.dts;
        currentFrame.byteLength += currentNal.data.byteLength;
        currentFrame.push(currentNal);
      }
    } // For the last frame, use the duration of the previous frame if we
    // have nothing better to go on


    if (frames.length && (!currentFrame.duration || currentFrame.duration <= 0)) {
      currentFrame.duration = frames[frames.length - 1].duration;
    } // Push the final frame
    // TODO added for LHLS, make sure this is OK


    frames.byteLength += currentFrame.byteLength;
    frames.nalCount += currentFrame.length;
    frames.duration += currentFrame.duration;
    frames.push(currentFrame);
    return frames;
  }; // Convert an array of frames into an array of Gop with each Gop being composed
  // of the frames that make up that Gop
  // Also keep track of cummulative data about the Gop from the frames such as the
  // Gop duration, starting pts, etc.


  var groupFramesIntoGops = function (frames) {
    var i,
        currentFrame,
        currentGop = [],
        gops = []; // We must pre-set some of the values on the Gop since we
    // keep running totals of these values

    currentGop.byteLength = 0;
    currentGop.nalCount = 0;
    currentGop.duration = 0;
    currentGop.pts = frames[0].pts;
    currentGop.dts = frames[0].dts; // store some metadata about all the Gops

    gops.byteLength = 0;
    gops.nalCount = 0;
    gops.duration = 0;
    gops.pts = frames[0].pts;
    gops.dts = frames[0].dts;

    for (i = 0; i < frames.length; i++) {
      currentFrame = frames[i];

      if (currentFrame.keyFrame) {
        // Since the very first frame is expected to be an keyframe
        // only push to the gops array when currentGop is not empty
        if (currentGop.length) {
          gops.push(currentGop);
          gops.byteLength += currentGop.byteLength;
          gops.nalCount += currentGop.nalCount;
          gops.duration += currentGop.duration;
        }

        currentGop = [currentFrame];
        currentGop.nalCount = currentFrame.length;
        currentGop.byteLength = currentFrame.byteLength;
        currentGop.pts = currentFrame.pts;
        currentGop.dts = currentFrame.dts;
        currentGop.duration = currentFrame.duration;
      } else {
        currentGop.duration += currentFrame.duration;
        currentGop.nalCount += currentFrame.length;
        currentGop.byteLength += currentFrame.byteLength;
        currentGop.push(currentFrame);
      }
    }

    if (gops.length && currentGop.duration <= 0) {
      currentGop.duration = gops[gops.length - 1].duration;
    }

    gops.byteLength += currentGop.byteLength;
    gops.nalCount += currentGop.nalCount;
    gops.duration += currentGop.duration; // push the final Gop

    gops.push(currentGop);
    return gops;
  };
  /*
   * Search for the first keyframe in the GOPs and throw away all frames
   * until that keyframe. Then extend the duration of the pulled keyframe
   * and pull the PTS and DTS of the keyframe so that it covers the time
   * range of the frames that were disposed.
   *
   * @param {Array} gops video GOPs
   * @returns {Array} modified video GOPs
   */


  var extendFirstKeyFrame = function (gops) {
    var currentGop;

    if (!gops[0][0].keyFrame && gops.length > 1) {
      // Remove the first GOP
      currentGop = gops.shift();
      gops.byteLength -= currentGop.byteLength;
      gops.nalCount -= currentGop.nalCount; // Extend the first frame of what is now the
      // first gop to cover the time period of the
      // frames we just removed

      gops[0][0].dts = currentGop.dts;
      gops[0][0].pts = currentGop.pts;
      gops[0][0].duration += currentGop.duration;
    }

    return gops;
  };
  /**
   * Default sample object
   * see ISO/IEC 14496-12:2012, section 8.6.4.3
   */


  var createDefaultSample = function () {
    return {
      size: 0,
      flags: {
        isLeading: 0,
        dependsOn: 1,
        isDependedOn: 0,
        hasRedundancy: 0,
        degradationPriority: 0,
        isNonSyncSample: 1
      }
    };
  };
  /*
   * Collates information from a video frame into an object for eventual
   * entry into an MP4 sample table.
   *
   * @param {Object} frame the video frame
   * @param {Number} dataOffset the byte offset to position the sample
   * @return {Object} object containing sample table info for a frame
   */


  var sampleForFrame = function (frame, dataOffset) {
    var sample = createDefaultSample();
    sample.dataOffset = dataOffset;
    sample.compositionTimeOffset = frame.pts - frame.dts;
    sample.duration = frame.duration;
    sample.size = 4 * frame.length; // Space for nal unit size

    sample.size += frame.byteLength;

    if (frame.keyFrame) {
      sample.flags.dependsOn = 2;
      sample.flags.isNonSyncSample = 0;
    }

    return sample;
  }; // generate the track's sample table from an array of gops


  var generateSampleTable$1 = function (gops, baseDataOffset) {
    var h,
        i,
        sample,
        currentGop,
        currentFrame,
        dataOffset = baseDataOffset || 0,
        samples = [];

    for (h = 0; h < gops.length; h++) {
      currentGop = gops[h];

      for (i = 0; i < currentGop.length; i++) {
        currentFrame = currentGop[i];
        sample = sampleForFrame(currentFrame, dataOffset);
        dataOffset += sample.size;
        samples.push(sample);
      }
    }

    return samples;
  }; // generate the track's raw mdat data from an array of gops


  var concatenateNalData = function (gops) {
    var h,
        i,
        j,
        currentGop,
        currentFrame,
        currentNal,
        dataOffset = 0,
        nalsByteLength = gops.byteLength,
        numberOfNals = gops.nalCount,
        totalByteLength = nalsByteLength + 4 * numberOfNals,
        data = new Uint8Array(totalByteLength),
        view = new DataView(data.buffer); // For each Gop..

    for (h = 0; h < gops.length; h++) {
      currentGop = gops[h]; // For each Frame..

      for (i = 0; i < currentGop.length; i++) {
        currentFrame = currentGop[i]; // For each NAL..

        for (j = 0; j < currentFrame.length; j++) {
          currentNal = currentFrame[j];
          view.setUint32(dataOffset, currentNal.data.byteLength);
          dataOffset += 4;
          data.set(currentNal.data, dataOffset);
          dataOffset += currentNal.data.byteLength;
        }
      }
    }

    return data;
  }; // generate the track's sample table from a frame


  var generateSampleTableForFrame = function (frame, baseDataOffset) {
    var sample,
        dataOffset = baseDataOffset || 0,
        samples = [];
    sample = sampleForFrame(frame, dataOffset);
    samples.push(sample);
    return samples;
  }; // generate the track's raw mdat data from a frame


  var concatenateNalDataForFrame = function (frame) {
    var i,
        currentNal,
        dataOffset = 0,
        nalsByteLength = frame.byteLength,
        numberOfNals = frame.length,
        totalByteLength = nalsByteLength + 4 * numberOfNals,
        data = new Uint8Array(totalByteLength),
        view = new DataView(data.buffer); // For each NAL..

    for (i = 0; i < frame.length; i++) {
      currentNal = frame[i];
      view.setUint32(dataOffset, currentNal.data.byteLength);
      dataOffset += 4;
      data.set(currentNal.data, dataOffset);
      dataOffset += currentNal.data.byteLength;
    }

    return data;
  };

  var frameUtils$1 = {
    groupNalsIntoFrames: groupNalsIntoFrames,
    groupFramesIntoGops: groupFramesIntoGops,
    extendFirstKeyFrame: extendFirstKeyFrame,
    generateSampleTable: generateSampleTable$1,
    concatenateNalData: concatenateNalData,
    generateSampleTableForFrame: generateSampleTableForFrame,
    concatenateNalDataForFrame: concatenateNalDataForFrame
  };
  /**
   * mux.js
   *
   * Copyright (c) Brightcove
   * Licensed Apache-2.0 https://github.com/videojs/mux.js/blob/master/LICENSE
   */

  var highPrefix = [33, 16, 5, 32, 164, 27];
  var lowPrefix = [33, 65, 108, 84, 1, 2, 4, 8, 168, 2, 4, 8, 17, 191, 252];

  var zeroFill = function (count) {
    var a = [];

    while (count--) {
      a.push(0);
    }

    return a;
  };

  var makeTable = function (metaTable) {
    return Object.keys(metaTable).reduce(function (obj, key) {
      obj[key] = new Uint8Array(metaTable[key].reduce(function (arr, part) {
        return arr.concat(part);
      }, []));
      return obj;
    }, {});
  };

  var silence;

  var silence_1 = function () {
    if (!silence) {
      // Frames-of-silence to use for filling in missing AAC frames
      var coneOfSilence = {
        96000: [highPrefix, [227, 64], zeroFill(154), [56]],
        88200: [highPrefix, [231], zeroFill(170), [56]],
        64000: [highPrefix, [248, 192], zeroFill(240), [56]],
        48000: [highPrefix, [255, 192], zeroFill(268), [55, 148, 128], zeroFill(54), [112]],
        44100: [highPrefix, [255, 192], zeroFill(268), [55, 163, 128], zeroFill(84), [112]],
        32000: [highPrefix, [255, 192], zeroFill(268), [55, 234], zeroFill(226), [112]],
        24000: [highPrefix, [255, 192], zeroFill(268), [55, 255, 128], zeroFill(268), [111, 112], zeroFill(126), [224]],
        16000: [highPrefix, [255, 192], zeroFill(268), [55, 255, 128], zeroFill(268), [111, 255], zeroFill(269), [223, 108], zeroFill(195), [1, 192]],
        12000: [lowPrefix, zeroFill(268), [3, 127, 248], zeroFill(268), [6, 255, 240], zeroFill(268), [13, 255, 224], zeroFill(268), [27, 253, 128], zeroFill(259), [56]],
        11025: [lowPrefix, zeroFill(268), [3, 127, 248], zeroFill(268), [6, 255, 240], zeroFill(268), [13, 255, 224], zeroFill(268), [27, 255, 192], zeroFill(268), [55, 175, 128], zeroFill(108), [112]],
        8000: [lowPrefix, zeroFill(268), [3, 121, 16], zeroFill(47), [7]]
      };
      silence = makeTable(coneOfSilence);
    }

    return silence;
  };
  /**
   * mux.js
   *
   * Copyright (c) Brightcove
   * Licensed Apache-2.0 https://github.com/videojs/mux.js/blob/master/LICENSE
   */


  var ONE_SECOND_IN_TS$4 = 90000,
      // 90kHz clock
  secondsToVideoTs,
      secondsToAudioTs,
      videoTsToSeconds,
      audioTsToSeconds,
      audioTsToVideoTs,
      videoTsToAudioTs,
      metadataTsToSeconds;

  secondsToVideoTs = function (seconds) {
    return seconds * ONE_SECOND_IN_TS$4;
  };

  secondsToAudioTs = function (seconds, sampleRate) {
    return seconds * sampleRate;
  };

  videoTsToSeconds = function (timestamp) {
    return timestamp / ONE_SECOND_IN_TS$4;
  };

  audioTsToSeconds = function (timestamp, sampleRate) {
    return timestamp / sampleRate;
  };

  audioTsToVideoTs = function (timestamp, sampleRate) {
    return secondsToVideoTs(audioTsToSeconds(timestamp, sampleRate));
  };

  videoTsToAudioTs = function (timestamp, sampleRate) {
    return secondsToAudioTs(videoTsToSeconds(timestamp), sampleRate);
  };
  /**
   * Adjust ID3 tag or caption timing information by the timeline pts values
   * (if keepOriginalTimestamps is false) and convert to seconds
   */


  metadataTsToSeconds = function (timestamp, timelineStartPts, keepOriginalTimestamps) {
    return videoTsToSeconds(keepOriginalTimestamps ? timestamp : timestamp - timelineStartPts);
  };

  var clock$2 = {
    ONE_SECOND_IN_TS: ONE_SECOND_IN_TS$4,
    secondsToVideoTs: secondsToVideoTs,
    secondsToAudioTs: secondsToAudioTs,
    videoTsToSeconds: videoTsToSeconds,
    audioTsToSeconds: audioTsToSeconds,
    audioTsToVideoTs: audioTsToVideoTs,
    videoTsToAudioTs: videoTsToAudioTs,
    metadataTsToSeconds: metadataTsToSeconds
  };
  /**
   * mux.js
   *
   * Copyright (c) Brightcove
   * Licensed Apache-2.0 https://github.com/videojs/mux.js/blob/master/LICENSE
   */

  var coneOfSilence = silence_1;
  var clock$1 = clock$2;
  /**
   * Sum the `byteLength` properties of the data in each AAC frame
   */

  var sumFrameByteLengths = function (array) {
    var i,
        currentObj,
        sum = 0; // sum the byteLength's all each nal unit in the frame

    for (i = 0; i < array.length; i++) {
      currentObj = array[i];
      sum += currentObj.data.byteLength;
    }

    return sum;
  }; // Possibly pad (prefix) the audio track with silence if appending this track
  // would lead to the introduction of a gap in the audio buffer


  var prefixWithSilence = function (track, frames, audioAppendStartTs, videoBaseMediaDecodeTime) {
    var baseMediaDecodeTimeTs,
        frameDuration = 0,
        audioGapDuration = 0,
        audioFillFrameCount = 0,
        audioFillDuration = 0,
        silentFrame,
        i,
        firstFrame;

    if (!frames.length) {
      return;
    }

    baseMediaDecodeTimeTs = clock$1.audioTsToVideoTs(track.baseMediaDecodeTime, track.samplerate); // determine frame clock duration based on sample rate, round up to avoid overfills

    frameDuration = Math.ceil(clock$1.ONE_SECOND_IN_TS / (track.samplerate / 1024));

    if (audioAppendStartTs && videoBaseMediaDecodeTime) {
      // insert the shortest possible amount (audio gap or audio to video gap)
      audioGapDuration = baseMediaDecodeTimeTs - Math.max(audioAppendStartTs, videoBaseMediaDecodeTime); // number of full frames in the audio gap

      audioFillFrameCount = Math.floor(audioGapDuration / frameDuration);
      audioFillDuration = audioFillFrameCount * frameDuration;
    } // don't attempt to fill gaps smaller than a single frame or larger
    // than a half second


    if (audioFillFrameCount < 1 || audioFillDuration > clock$1.ONE_SECOND_IN_TS / 2) {
      return;
    }

    silentFrame = coneOfSilence()[track.samplerate];

    if (!silentFrame) {
      // we don't have a silent frame pregenerated for the sample rate, so use a frame
      // from the content instead
      silentFrame = frames[0].data;
    }

    for (i = 0; i < audioFillFrameCount; i++) {
      firstFrame = frames[0];
      frames.splice(0, 0, {
        data: silentFrame,
        dts: firstFrame.dts - frameDuration,
        pts: firstFrame.pts - frameDuration
      });
    }

    track.baseMediaDecodeTime -= Math.floor(clock$1.videoTsToAudioTs(audioFillDuration, track.samplerate));
    return audioFillDuration;
  }; // If the audio segment extends before the earliest allowed dts
  // value, remove AAC frames until starts at or after the earliest
  // allowed DTS so that we don't end up with a negative baseMedia-
  // DecodeTime for the audio track


  var trimAdtsFramesByEarliestDts = function (adtsFrames, track, earliestAllowedDts) {
    if (track.minSegmentDts >= earliestAllowedDts) {
      return adtsFrames;
    } // We will need to recalculate the earliest segment Dts


    track.minSegmentDts = Infinity;
    return adtsFrames.filter(function (currentFrame) {
      // If this is an allowed frame, keep it and record it's Dts
      if (currentFrame.dts >= earliestAllowedDts) {
        track.minSegmentDts = Math.min(track.minSegmentDts, currentFrame.dts);
        track.minSegmentPts = track.minSegmentDts;
        return true;
      } // Otherwise, discard it


      return false;
    });
  }; // generate the track's raw mdat data from an array of frames


  var generateSampleTable = function (frames) {
    var i,
        currentFrame,
        samples = [];

    for (i = 0; i < frames.length; i++) {
      currentFrame = frames[i];
      samples.push({
        size: currentFrame.data.byteLength,
        duration: 1024 // For AAC audio, all samples contain 1024 samples

      });
    }

    return samples;
  }; // generate the track's sample table from an array of frames


  var concatenateFrameData = function (frames) {
    var i,
        currentFrame,
        dataOffset = 0,
        data = new Uint8Array(sumFrameByteLengths(frames));

    for (i = 0; i < frames.length; i++) {
      currentFrame = frames[i];
      data.set(currentFrame.data, dataOffset);
      dataOffset += currentFrame.data.byteLength;
    }

    return data;
  };

  var audioFrameUtils$1 = {
    prefixWithSilence: prefixWithSilence,
    trimAdtsFramesByEarliestDts: trimAdtsFramesByEarliestDts,
    generateSampleTable: generateSampleTable,
    concatenateFrameData: concatenateFrameData
  };
  /**
   * mux.js
   *
   * Copyright (c) Brightcove
   * Licensed Apache-2.0 https://github.com/videojs/mux.js/blob/master/LICENSE
   */

  var ONE_SECOND_IN_TS$3 = clock$2.ONE_SECOND_IN_TS;
  /**
   * Store information about the start and end of the track and the
   * duration for each frame/sample we process in order to calculate
   * the baseMediaDecodeTime
   */

  var collectDtsInfo = function (track, data) {
    if (typeof data.pts === 'number') {
      if (track.timelineStartInfo.pts === undefined) {
        track.timelineStartInfo.pts = data.pts;
      }

      if (track.minSegmentPts === undefined) {
        track.minSegmentPts = data.pts;
      } else {
        track.minSegmentPts = Math.min(track.minSegmentPts, data.pts);
      }

      if (track.maxSegmentPts === undefined) {
        track.maxSegmentPts = data.pts;
      } else {
        track.maxSegmentPts = Math.max(track.maxSegmentPts, data.pts);
      }
    }

    if (typeof data.dts === 'number') {
      if (track.timelineStartInfo.dts === undefined) {
        track.timelineStartInfo.dts = data.dts;
      }

      if (track.minSegmentDts === undefined) {
        track.minSegmentDts = data.dts;
      } else {
        track.minSegmentDts = Math.min(track.minSegmentDts, data.dts);
      }

      if (track.maxSegmentDts === undefined) {
        track.maxSegmentDts = data.dts;
      } else {
        track.maxSegmentDts = Math.max(track.maxSegmentDts, data.dts);
      }
    }
  };
  /**
   * Clear values used to calculate the baseMediaDecodeTime between
   * tracks
   */


  var clearDtsInfo = function (track) {
    delete track.minSegmentDts;
    delete track.maxSegmentDts;
    delete track.minSegmentPts;
    delete track.maxSegmentPts;
  };
  /**
   * Calculate the track's baseMediaDecodeTime based on the earliest
   * DTS the transmuxer has ever seen and the minimum DTS for the
   * current track
   * @param track {object} track metadata configuration
   * @param keepOriginalTimestamps {boolean} If true, keep the timestamps
   *        in the source; false to adjust the first segment to start at 0.
   */


  var calculateTrackBaseMediaDecodeTime = function (track, keepOriginalTimestamps) {
    var baseMediaDecodeTime,
        scale,
        minSegmentDts = track.minSegmentDts; // Optionally adjust the time so the first segment starts at zero.

    if (!keepOriginalTimestamps) {
      minSegmentDts -= track.timelineStartInfo.dts;
    } // track.timelineStartInfo.baseMediaDecodeTime is the location, in time, where
    // we want the start of the first segment to be placed


    baseMediaDecodeTime = track.timelineStartInfo.baseMediaDecodeTime; // Add to that the distance this segment is from the very first

    baseMediaDecodeTime += minSegmentDts; // baseMediaDecodeTime must not become negative

    baseMediaDecodeTime = Math.max(0, baseMediaDecodeTime);

    if (track.type === 'audio') {
      // Audio has a different clock equal to the sampling_rate so we need to
      // scale the PTS values into the clock rate of the track
      scale = track.samplerate / ONE_SECOND_IN_TS$3;
      baseMediaDecodeTime *= scale;
      baseMediaDecodeTime = Math.floor(baseMediaDecodeTime);
    }

    return baseMediaDecodeTime;
  };

  var trackDecodeInfo$1 = {
    clearDtsInfo: clearDtsInfo,
    calculateTrackBaseMediaDecodeTime: calculateTrackBaseMediaDecodeTime,
    collectDtsInfo: collectDtsInfo
  };
  /**
   * mux.js
   *
   * Copyright (c) Brightcove
   * Licensed Apache-2.0 https://github.com/videojs/mux.js/blob/master/LICENSE
   *
   * Reads in-band caption information from a video elementary
   * stream. Captions must follow the CEA-708 standard for injection
   * into an MPEG-2 transport streams.
   * @see https://en.wikipedia.org/wiki/CEA-708
   * @see https://www.gpo.gov/fdsys/pkg/CFR-2007-title47-vol1/pdf/CFR-2007-title47-vol1-sec15-119.pdf
   */
  // payload type field to indicate how they are to be
  // interpreted. CEAS-708 caption content is always transmitted with
  // payload type 0x04.

  var USER_DATA_REGISTERED_ITU_T_T35 = 4,
      RBSP_TRAILING_BITS = 128;
  /**
    * Parse a supplemental enhancement information (SEI) NAL unit.
    * Stops parsing once a message of type ITU T T35 has been found.
    *
    * @param bytes {Uint8Array} the bytes of a SEI NAL unit
    * @return {object} the parsed SEI payload
    * @see Rec. ITU-T H.264, 7.3.2.3.1
    */

  var parseSei = function (bytes) {
    var i = 0,
        result = {
      payloadType: -1,
      payloadSize: 0
    },
        payloadType = 0,
        payloadSize = 0; // go through the sei_rbsp parsing each each individual sei_message

    while (i < bytes.byteLength) {
      // stop once we have hit the end of the sei_rbsp
      if (bytes[i] === RBSP_TRAILING_BITS) {
        break;
      } // Parse payload type


      while (bytes[i] === 0xFF) {
        payloadType += 255;
        i++;
      }

      payloadType += bytes[i++]; // Parse payload size

      while (bytes[i] === 0xFF) {
        payloadSize += 255;
        i++;
      }

      payloadSize += bytes[i++]; // this sei_message is a 608/708 caption so save it and break
      // there can only ever be one caption message in a frame's sei

      if (!result.payload && payloadType === USER_DATA_REGISTERED_ITU_T_T35) {
        var userIdentifier = String.fromCharCode(bytes[i + 3], bytes[i + 4], bytes[i + 5], bytes[i + 6]);

        if (userIdentifier === 'GA94') {
          result.payloadType = payloadType;
          result.payloadSize = payloadSize;
          result.payload = bytes.subarray(i, i + payloadSize);
          break;
        } else {
          result.payload = void 0;
        }
      } // skip the payload and parse the next message


      i += payloadSize;
      payloadType = 0;
      payloadSize = 0;
    }

    return result;
  }; // see ANSI/SCTE 128-1 (2013), section 8.1


  var parseUserData = function (sei) {
    // itu_t_t35_contry_code must be 181 (United States) for
    // captions
    if (sei.payload[0] !== 181) {
      return null;
    } // itu_t_t35_provider_code should be 49 (ATSC) for captions


    if ((sei.payload[1] << 8 | sei.payload[2]) !== 49) {
      return null;
    } // the user_identifier should be "GA94" to indicate ATSC1 data


    if (String.fromCharCode(sei.payload[3], sei.payload[4], sei.payload[5], sei.payload[6]) !== 'GA94') {
      return null;
    } // finally, user_data_type_code should be 0x03 for caption data


    if (sei.payload[7] !== 0x03) {
      return null;
    } // return the user_data_type_structure and strip the trailing
    // marker bits


    return sei.payload.subarray(8, sei.payload.length - 1);
  }; // see CEA-708-D, section 4.4


  var parseCaptionPackets = function (pts, userData) {
    var results = [],
        i,
        count,
        offset,
        data; // if this is just filler, return immediately

    if (!(userData[0] & 0x40)) {
      return results;
    } // parse out the cc_data_1 and cc_data_2 fields


    count = userData[0] & 0x1f;

    for (i = 0; i < count; i++) {
      offset = i * 3;
      data = {
        type: userData[offset + 2] & 0x03,
        pts: pts
      }; // capture cc data when cc_valid is 1

      if (userData[offset + 2] & 0x04) {
        data.ccData = userData[offset + 3] << 8 | userData[offset + 4];
        results.push(data);
      }
    }

    return results;
  };

  var discardEmulationPreventionBytes$1 = function (data) {
    var length = data.byteLength,
        emulationPreventionBytesPositions = [],
        i = 1,
        newLength,
        newData; // Find all `Emulation Prevention Bytes`

    while (i < length - 2) {
      if (data[i] === 0 && data[i + 1] === 0 && data[i + 2] === 0x03) {
        emulationPreventionBytesPositions.push(i + 2);
        i += 2;
      } else {
        i++;
      }
    } // If no Emulation Prevention Bytes were found just return the original
    // array


    if (emulationPreventionBytesPositions.length === 0) {
      return data;
    } // Create a new array to hold the NAL unit data


    newLength = length - emulationPreventionBytesPositions.length;
    newData = new Uint8Array(newLength);
    var sourceIndex = 0;

    for (i = 0; i < newLength; sourceIndex++, i++) {
      if (sourceIndex === emulationPreventionBytesPositions[0]) {
        // Skip this byte
        sourceIndex++; // Remove this position index

        emulationPreventionBytesPositions.shift();
      }

      newData[i] = data[sourceIndex];
    }

    return newData;
  }; // exports


  var captionPacketParser = {
    parseSei: parseSei,
    parseUserData: parseUserData,
    parseCaptionPackets: parseCaptionPackets,
    discardEmulationPreventionBytes: discardEmulationPreventionBytes$1,
    USER_DATA_REGISTERED_ITU_T_T35: USER_DATA_REGISTERED_ITU_T_T35
  };
  /**
   * mux.js
   *
   * Copyright (c) Brightcove
   * Licensed Apache-2.0 https://github.com/videojs/mux.js/blob/master/LICENSE
   *
   * Reads in-band caption information from a video elementary
   * stream. Captions must follow the CEA-708 standard for injection
   * into an MPEG-2 transport streams.
   * @see https://en.wikipedia.org/wiki/CEA-708
   * @see https://www.gpo.gov/fdsys/pkg/CFR-2007-title47-vol1/pdf/CFR-2007-title47-vol1-sec15-119.pdf
   */
  // Link To Transport
  // -----------------

  var Stream$7 = stream;
  var cea708Parser = captionPacketParser;

  var CaptionStream$2 = function (options) {
    options = options || {};
    CaptionStream$2.prototype.init.call(this); // parse708captions flag, default to true

    this.parse708captions_ = typeof options.parse708captions === 'boolean' ? options.parse708captions : true;
    this.captionPackets_ = [];
    this.ccStreams_ = [new Cea608Stream(0, 0), // eslint-disable-line no-use-before-define
    new Cea608Stream(0, 1), // eslint-disable-line no-use-before-define
    new Cea608Stream(1, 0), // eslint-disable-line no-use-before-define
    new Cea608Stream(1, 1) // eslint-disable-line no-use-before-define
    ];

    if (this.parse708captions_) {
      this.cc708Stream_ = new Cea708Stream({
        captionServices: options.captionServices
      }); // eslint-disable-line no-use-before-define
    }

    this.reset(); // forward data and done events from CCs to this CaptionStream

    this.ccStreams_.forEach(function (cc) {
      cc.on('data', this.trigger.bind(this, 'data'));
      cc.on('partialdone', this.trigger.bind(this, 'partialdone'));
      cc.on('done', this.trigger.bind(this, 'done'));
    }, this);

    if (this.parse708captions_) {
      this.cc708Stream_.on('data', this.trigger.bind(this, 'data'));
      this.cc708Stream_.on('partialdone', this.trigger.bind(this, 'partialdone'));
      this.cc708Stream_.on('done', this.trigger.bind(this, 'done'));
    }
  };

  CaptionStream$2.prototype = new Stream$7();

  CaptionStream$2.prototype.push = function (event) {
    var sei, userData, newCaptionPackets; // only examine SEI NALs

    if (event.nalUnitType !== 'sei_rbsp') {
      return;
    } // parse the sei


    sei = cea708Parser.parseSei(event.escapedRBSP); // no payload data, skip

    if (!sei.payload) {
      return;
    } // ignore everything but user_data_registered_itu_t_t35


    if (sei.payloadType !== cea708Parser.USER_DATA_REGISTERED_ITU_T_T35) {
      return;
    } // parse out the user data payload


    userData = cea708Parser.parseUserData(sei); // ignore unrecognized userData

    if (!userData) {
      return;
    } // Sometimes, the same segment # will be downloaded twice. To stop the
    // caption data from being processed twice, we track the latest dts we've
    // received and ignore everything with a dts before that. However, since
    // data for a specific dts can be split across packets on either side of
    // a segment boundary, we need to make sure we *don't* ignore the packets
    // from the *next* segment that have dts === this.latestDts_. By constantly
    // tracking the number of packets received with dts === this.latestDts_, we
    // know how many should be ignored once we start receiving duplicates.


    if (event.dts < this.latestDts_) {
      // We've started getting older data, so set the flag.
      this.ignoreNextEqualDts_ = true;
      return;
    } else if (event.dts === this.latestDts_ && this.ignoreNextEqualDts_) {
      this.numSameDts_--;

      if (!this.numSameDts_) {
        // We've received the last duplicate packet, time to start processing again
        this.ignoreNextEqualDts_ = false;
      }

      return;
    } // parse out CC data packets and save them for later


    newCaptionPackets = cea708Parser.parseCaptionPackets(event.pts, userData);
    this.captionPackets_ = this.captionPackets_.concat(newCaptionPackets);

    if (this.latestDts_ !== event.dts) {
      this.numSameDts_ = 0;
    }

    this.numSameDts_++;
    this.latestDts_ = event.dts;
  };

  CaptionStream$2.prototype.flushCCStreams = function (flushType) {
    this.ccStreams_.forEach(function (cc) {
      return flushType === 'flush' ? cc.flush() : cc.partialFlush();
    }, this);
  };

  CaptionStream$2.prototype.flushStream = function (flushType) {
    // make sure we actually parsed captions before proceeding
    if (!this.captionPackets_.length) {
      this.flushCCStreams(flushType);
      return;
    } // In Chrome, the Array#sort function is not stable so add a
    // presortIndex that we can use to ensure we get a stable-sort


    this.captionPackets_.forEach(function (elem, idx) {
      elem.presortIndex = idx;
    }); // sort caption byte-pairs based on their PTS values

    this.captionPackets_.sort(function (a, b) {
      if (a.pts === b.pts) {
        return a.presortIndex - b.presortIndex;
      }

      return a.pts - b.pts;
    });
    this.captionPackets_.forEach(function (packet) {
      if (packet.type < 2) {
        // Dispatch packet to the right Cea608Stream
        this.dispatchCea608Packet(packet);
      } else {
        // Dispatch packet to the Cea708Stream
        this.dispatchCea708Packet(packet);
      }
    }, this);
    this.captionPackets_.length = 0;
    this.flushCCStreams(flushType);
  };

  CaptionStream$2.prototype.flush = function () {
    return this.flushStream('flush');
  }; // Only called if handling partial data


  CaptionStream$2.prototype.partialFlush = function () {
    return this.flushStream('partialFlush');
  };

  CaptionStream$2.prototype.reset = function () {
    this.latestDts_ = null;
    this.ignoreNextEqualDts_ = false;
    this.numSameDts_ = 0;
    this.activeCea608Channel_ = [null, null];
    this.ccStreams_.forEach(function (ccStream) {
      ccStream.reset();
    });
  }; // From the CEA-608 spec:

  /*
   * When XDS sub-packets are interleaved with other services, the end of each sub-packet shall be followed
   * by a control pair to change to a different service. When any of the control codes from 0x10 to 0x1F is
   * used to begin a control code pair, it indicates the return to captioning or Text data. The control code pair
   * and subsequent data should then be processed according to the FCC rules. It may be necessary for the
   * line 21 data encoder to automatically insert a control code pair (i.e. RCL, RU2, RU3, RU4, RDC, or RTD)
   * to switch to captioning or Text.
  */
  // With that in mind, we ignore any data between an XDS control code and a
  // subsequent closed-captioning control code.


  CaptionStream$2.prototype.dispatchCea608Packet = function (packet) {
    // NOTE: packet.type is the CEA608 field
    if (this.setsTextOrXDSActive(packet)) {
      this.activeCea608Channel_[packet.type] = null;
    } else if (this.setsChannel1Active(packet)) {
      this.activeCea608Channel_[packet.type] = 0;
    } else if (this.setsChannel2Active(packet)) {
      this.activeCea608Channel_[packet.type] = 1;
    }

    if (this.activeCea608Channel_[packet.type] === null) {
      // If we haven't received anything to set the active channel, or the
      // packets are Text/XDS data, discard the data; we don't want jumbled
      // captions
      return;
    }

    this.ccStreams_[(packet.type << 1) + this.activeCea608Channel_[packet.type]].push(packet);
  };

  CaptionStream$2.prototype.setsChannel1Active = function (packet) {
    return (packet.ccData & 0x7800) === 0x1000;
  };

  CaptionStream$2.prototype.setsChannel2Active = function (packet) {
    return (packet.ccData & 0x7800) === 0x1800;
  };

  CaptionStream$2.prototype.setsTextOrXDSActive = function (packet) {
    return (packet.ccData & 0x7100) === 0x0100 || (packet.ccData & 0x78fe) === 0x102a || (packet.ccData & 0x78fe) === 0x182a;
  };

  CaptionStream$2.prototype.dispatchCea708Packet = function (packet) {
    if (this.parse708captions_) {
      this.cc708Stream_.push(packet);
    }
  }; // ----------------------
  // Session to Application
  // ----------------------
  // This hash maps special and extended character codes to their
  // proper Unicode equivalent. The first one-byte key is just a
  // non-standard character code. The two-byte keys that follow are
  // the extended CEA708 character codes, along with the preceding
  // 0x10 extended character byte to distinguish these codes from
  // non-extended character codes. Every CEA708 character code that
  // is not in this object maps directly to a standard unicode
  // character code.
  // The transparent space and non-breaking transparent space are
  // technically not fully supported since there is no code to
  // make them transparent, so they have normal non-transparent
  // stand-ins.
  // The special closed caption (CC) character isn't a standard
  // unicode character, so a fairly similar unicode character was
  // chosen in it's place.


  var CHARACTER_TRANSLATION_708 = {
    0x7f: 0x266a,
    // ♪
    0x1020: 0x20,
    // Transparent Space
    0x1021: 0xa0,
    // Nob-breaking Transparent Space
    0x1025: 0x2026,
    // …
    0x102a: 0x0160,
    // Š
    0x102c: 0x0152,
    // Œ
    0x1030: 0x2588,
    // █
    0x1031: 0x2018,
    // ‘
    0x1032: 0x2019,
    // ’
    0x1033: 0x201c,
    // “
    0x1034: 0x201d,
    // ”
    0x1035: 0x2022,
    // •
    0x1039: 0x2122,
    // ™
    0x103a: 0x0161,
    // š
    0x103c: 0x0153,
    // œ
    0x103d: 0x2120,
    // ℠
    0x103f: 0x0178,
    // Ÿ
    0x1076: 0x215b,
    // ⅛
    0x1077: 0x215c,
    // ⅜
    0x1078: 0x215d,
    // ⅝
    0x1079: 0x215e,
    // ⅞
    0x107a: 0x23d0,
    // ⏐
    0x107b: 0x23a4,
    // ⎤
    0x107c: 0x23a3,
    // ⎣
    0x107d: 0x23af,
    // ⎯
    0x107e: 0x23a6,
    // ⎦
    0x107f: 0x23a1,
    // ⎡
    0x10a0: 0x3138 // ㄸ (CC char)

  };

  var get708CharFromCode = function (code) {
    var newCode = CHARACTER_TRANSLATION_708[code] || code;

    if (code & 0x1000 && code === newCode) {
      // Invalid extended code
      return '';
    }

    return String.fromCharCode(newCode);
  };

  var within708TextBlock = function (b) {
    return 0x20 <= b && b <= 0x7f || 0xa0 <= b && b <= 0xff;
  };

  var Cea708Window = function (windowNum) {
    this.windowNum = windowNum;
    this.reset();
  };

  Cea708Window.prototype.reset = function () {
    this.clearText();
    this.pendingNewLine = false;
    this.winAttr = {};
    this.penAttr = {};
    this.penLoc = {};
    this.penColor = {}; // These default values are arbitrary,
    // defineWindow will usually override them

    this.visible = 0;
    this.rowLock = 0;
    this.columnLock = 0;
    this.priority = 0;
    this.relativePositioning = 0;
    this.anchorVertical = 0;
    this.anchorHorizontal = 0;
    this.anchorPoint = 0;
    this.rowCount = 1;
    this.virtualRowCount = this.rowCount + 1;
    this.columnCount = 41;
    this.windowStyle = 0;
    this.penStyle = 0;
  };

  Cea708Window.prototype.getText = function () {
    return this.rows.join('\n');
  };

  Cea708Window.prototype.clearText = function () {
    this.rows = [''];
    this.rowIdx = 0;
  };

  Cea708Window.prototype.newLine = function (pts) {
    if (this.rows.length >= this.virtualRowCount && typeof this.beforeRowOverflow === 'function') {
      this.beforeRowOverflow(pts);
    }

    if (this.rows.length > 0) {
      this.rows.push('');
      this.rowIdx++;
    } // Show all virtual rows since there's no visible scrolling


    while (this.rows.length > this.virtualRowCount) {
      this.rows.shift();
      this.rowIdx--;
    }
  };

  Cea708Window.prototype.isEmpty = function () {
    if (this.rows.length === 0) {
      return true;
    } else if (this.rows.length === 1) {
      return this.rows[0] === '';
    }

    return false;
  };

  Cea708Window.prototype.addText = function (text) {
    this.rows[this.rowIdx] += text;
  };

  Cea708Window.prototype.backspace = function () {
    if (!this.isEmpty()) {
      var row = this.rows[this.rowIdx];
      this.rows[this.rowIdx] = row.substr(0, row.length - 1);
    }
  };

  var Cea708Service = function (serviceNum, encoding, stream) {
    this.serviceNum = serviceNum;
    this.text = '';
    this.currentWindow = new Cea708Window(-1);
    this.windows = [];
    this.stream = stream; // Try to setup a TextDecoder if an `encoding` value was provided

    if (typeof encoding === 'string') {
      this.createTextDecoder(encoding);
    }
  };
  /**
   * Initialize service windows
   * Must be run before service use
   *
   * @param  {Integer}  pts               PTS value
   * @param  {Function} beforeRowOverflow Function to execute before row overflow of a window
   */


  Cea708Service.prototype.init = function (pts, beforeRowOverflow) {
    this.startPts = pts;

    for (var win = 0; win < 8; win++) {
      this.windows[win] = new Cea708Window(win);

      if (typeof beforeRowOverflow === 'function') {
        this.windows[win].beforeRowOverflow = beforeRowOverflow;
      }
    }
  };
  /**
   * Set current window of service to be affected by commands
   *
   * @param  {Integer} windowNum Window number
   */


  Cea708Service.prototype.setCurrentWindow = function (windowNum) {
    this.currentWindow = this.windows[windowNum];
  };
  /**
   * Try to create a TextDecoder if it is natively supported
   */


  Cea708Service.prototype.createTextDecoder = function (encoding) {
    if (typeof TextDecoder === 'undefined') {
      this.stream.trigger('log', {
        level: 'warn',
        message: 'The `encoding` option is unsupported without TextDecoder support'
      });
    } else {
      try {
        this.textDecoder_ = new TextDecoder(encoding);
      } catch (error) {
        this.stream.trigger('log', {
          level: 'warn',
          message: 'TextDecoder could not be created with ' + encoding + ' encoding. ' + error
        });
      }
    }
  };

  var Cea708Stream = function (options) {
    options = options || {};
    Cea708Stream.prototype.init.call(this);
    var self = this;
    var captionServices = options.captionServices || {};
    var captionServiceEncodings = {};
    var serviceProps; // Get service encodings from captionServices option block

    Object.keys(captionServices).forEach(serviceName => {
      serviceProps = captionServices[serviceName];

      if (/^SERVICE/.test(serviceName)) {
        captionServiceEncodings[serviceName] = serviceProps.encoding;
      }
    });
    this.serviceEncodings = captionServiceEncodings;
    this.current708Packet = null;
    this.services = {};

    this.push = function (packet) {
      if (packet.type === 3) {
        // 708 packet start
        self.new708Packet();
        self.add708Bytes(packet);
      } else {
        if (self.current708Packet === null) {
          // This should only happen at the start of a file if there's no packet start.
          self.new708Packet();
        }

        self.add708Bytes(packet);
      }
    };
  };

  Cea708Stream.prototype = new Stream$7();
  /**
   * Push current 708 packet, create new 708 packet.
   */

  Cea708Stream.prototype.new708Packet = function () {
    if (this.current708Packet !== null) {
      this.push708Packet();
    }

    this.current708Packet = {
      data: [],
      ptsVals: []
    };
  };
  /**
   * Add pts and both bytes from packet into current 708 packet.
   */


  Cea708Stream.prototype.add708Bytes = function (packet) {
    var data = packet.ccData;
    var byte0 = data >>> 8;
    var byte1 = data & 0xff; // I would just keep a list of packets instead of bytes, but it isn't clear in the spec
    // that service blocks will always line up with byte pairs.

    this.current708Packet.ptsVals.push(packet.pts);
    this.current708Packet.data.push(byte0);
    this.current708Packet.data.push(byte1);
  };
  /**
   * Parse completed 708 packet into service blocks and push each service block.
   */


  Cea708Stream.prototype.push708Packet = function () {
    var packet708 = this.current708Packet;
    var packetData = packet708.data;
    var serviceNum = null;
    var blockSize = null;
    var i = 0;
    var b = packetData[i++];
    packet708.seq = b >> 6;
    packet708.sizeCode = b & 0x3f; // 0b00111111;

    for (; i < packetData.length; i++) {
      b = packetData[i++];
      serviceNum = b >> 5;
      blockSize = b & 0x1f; // 0b00011111

      if (serviceNum === 7 && blockSize > 0) {
        // Extended service num
        b = packetData[i++];
        serviceNum = b;
      }

      this.pushServiceBlock(serviceNum, i, blockSize);

      if (blockSize > 0) {
        i += blockSize - 1;
      }
    }
  };
  /**
   * Parse service block, execute commands, read text.
   *
   * Note: While many of these commands serve important purposes,
   * many others just parse out the parameters or attributes, but
   * nothing is done with them because this is not a full and complete
   * implementation of the entire 708 spec.
   *
   * @param  {Integer} serviceNum Service number
   * @param  {Integer} start      Start index of the 708 packet data
   * @param  {Integer} size       Block size
   */


  Cea708Stream.prototype.pushServiceBlock = function (serviceNum, start, size) {
    var b;
    var i = start;
    var packetData = this.current708Packet.data;
    var service = this.services[serviceNum];

    if (!service) {
      service = this.initService(serviceNum, i);
    }

    for (; i < start + size && i < packetData.length; i++) {
      b = packetData[i];

      if (within708TextBlock(b)) {
        i = this.handleText(i, service);
      } else if (b === 0x18) {
        i = this.multiByteCharacter(i, service);
      } else if (b === 0x10) {
        i = this.extendedCommands(i, service);
      } else if (0x80 <= b && b <= 0x87) {
        i = this.setCurrentWindow(i, service);
      } else if (0x98 <= b && b <= 0x9f) {
        i = this.defineWindow(i, service);
      } else if (b === 0x88) {
        i = this.clearWindows(i, service);
      } else if (b === 0x8c) {
        i = this.deleteWindows(i, service);
      } else if (b === 0x89) {
        i = this.displayWindows(i, service);
      } else if (b === 0x8a) {
        i = this.hideWindows(i, service);
      } else if (b === 0x8b) {
        i = this.toggleWindows(i, service);
      } else if (b === 0x97) {
        i = this.setWindowAttributes(i, service);
      } else if (b === 0x90) {
        i = this.setPenAttributes(i, service);
      } else if (b === 0x91) {
        i = this.setPenColor(i, service);
      } else if (b === 0x92) {
        i = this.setPenLocation(i, service);
      } else if (b === 0x8f) {
        service = this.reset(i, service);
      } else if (b === 0x08) {
        // BS: Backspace
        service.currentWindow.backspace();
      } else if (b === 0x0c) {
        // FF: Form feed
        service.currentWindow.clearText();
      } else if (b === 0x0d) {
        // CR: Carriage return
        service.currentWindow.pendingNewLine = true;
      } else if (b === 0x0e) {
        // HCR: Horizontal carriage return
        service.currentWindow.clearText();
      } else if (b === 0x8d) {
        // DLY: Delay, nothing to do
        i++;
      } else ;
    }
  };
  /**
   * Execute an extended command
   *
   * @param  {Integer} i        Current index in the 708 packet
   * @param  {Service} service  The service object to be affected
   * @return {Integer}          New index after parsing
   */


  Cea708Stream.prototype.extendedCommands = function (i, service) {
    var packetData = this.current708Packet.data;
    var b = packetData[++i];

    if (within708TextBlock(b)) {
      i = this.handleText(i, service, {
        isExtended: true
      });
    }

    return i;
  };
  /**
   * Get PTS value of a given byte index
   *
   * @param  {Integer} byteIndex  Index of the byte
   * @return {Integer}            PTS
   */


  Cea708Stream.prototype.getPts = function (byteIndex) {
    // There's 1 pts value per 2 bytes
    return this.current708Packet.ptsVals[Math.floor(byteIndex / 2)];
  };
  /**
   * Initializes a service
   *
   * @param  {Integer} serviceNum Service number
   * @return {Service}            Initialized service object
   */


  Cea708Stream.prototype.initService = function (serviceNum, i) {
    var serviceName = 'SERVICE' + serviceNum;
    var self = this;
    var serviceName;
    var encoding;

    if (serviceName in this.serviceEncodings) {
      encoding = this.serviceEncodings[serviceName];
    }

    this.services[serviceNum] = new Cea708Service(serviceNum, encoding, self);
    this.services[serviceNum].init(this.getPts(i), function (pts) {
      self.flushDisplayed(pts, self.services[serviceNum]);
    });
    return this.services[serviceNum];
  };
  /**
   * Execute text writing to current window
   *
   * @param  {Integer} i        Current index in the 708 packet
   * @param  {Service} service  The service object to be affected
   * @return {Integer}          New index after parsing
   */


  Cea708Stream.prototype.handleText = function (i, service, options) {
    var isExtended = options && options.isExtended;
    var isMultiByte = options && options.isMultiByte;
    var packetData = this.current708Packet.data;
    var extended = isExtended ? 0x1000 : 0x0000;
    var currentByte = packetData[i];
    var nextByte = packetData[i + 1];
    var win = service.currentWindow;
    var char;
    var charCodeArray; // Converts an array of bytes to a unicode hex string.

    function toHexString(byteArray) {
      return byteArray.map(byte => {
        return ('0' + (byte & 0xFF).toString(16)).slice(-2);
      }).join('');
    }

    if (isMultiByte) {
      charCodeArray = [currentByte, nextByte];
      i++;
    } else {
      charCodeArray = [currentByte];
    } // Use the TextDecoder if one was created for this service


    if (service.textDecoder_ && !isExtended) {
      char = service.textDecoder_.decode(new Uint8Array(charCodeArray));
    } else {
      // We assume any multi-byte char without a decoder is unicode.
      if (isMultiByte) {
        const unicode = toHexString(charCodeArray); // Takes a unicode hex string and creates a single character.

        char = String.fromCharCode(parseInt(unicode, 16));
      } else {
        char = get708CharFromCode(extended | currentByte);
      }
    }

    if (win.pendingNewLine && !win.isEmpty()) {
      win.newLine(this.getPts(i));
    }

    win.pendingNewLine = false;
    win.addText(char);
    return i;
  };
  /**
   * Handle decoding of multibyte character
   *
   * @param  {Integer} i        Current index in the 708 packet
   * @param  {Service} service  The service object to be affected
   * @return {Integer}          New index after parsing
   */


  Cea708Stream.prototype.multiByteCharacter = function (i, service) {
    var packetData = this.current708Packet.data;
    var firstByte = packetData[i + 1];
    var secondByte = packetData[i + 2];

    if (within708TextBlock(firstByte) && within708TextBlock(secondByte)) {
      i = this.handleText(++i, service, {
        isMultiByte: true
      });
    }

    return i;
  };
  /**
   * Parse and execute the CW# command.
   *
   * Set the current window.
   *
   * @param  {Integer} i        Current index in the 708 packet
   * @param  {Service} service  The service object to be affected
   * @return {Integer}          New index after parsing
   */


  Cea708Stream.prototype.setCurrentWindow = function (i, service) {
    var packetData = this.current708Packet.data;
    var b = packetData[i];
    var windowNum = b & 0x07;
    service.setCurrentWindow(windowNum);
    return i;
  };
  /**
   * Parse and execute the DF# command.
   *
   * Define a window and set it as the current window.
   *
   * @param  {Integer} i        Current index in the 708 packet
   * @param  {Service} service  The service object to be affected
   * @return {Integer}          New index after parsing
   */


  Cea708Stream.prototype.defineWindow = function (i, service) {
    var packetData = this.current708Packet.data;
    var b = packetData[i];
    var windowNum = b & 0x07;
    service.setCurrentWindow(windowNum);
    var win = service.currentWindow;
    b = packetData[++i];
    win.visible = (b & 0x20) >> 5; // v

    win.rowLock = (b & 0x10) >> 4; // rl

    win.columnLock = (b & 0x08) >> 3; // cl

    win.priority = b & 0x07; // p

    b = packetData[++i];
    win.relativePositioning = (b & 0x80) >> 7; // rp

    win.anchorVertical = b & 0x7f; // av

    b = packetData[++i];
    win.anchorHorizontal = b; // ah

    b = packetData[++i];
    win.anchorPoint = (b & 0xf0) >> 4; // ap

    win.rowCount = b & 0x0f; // rc

    b = packetData[++i];
    win.columnCount = b & 0x3f; // cc

    b = packetData[++i];
    win.windowStyle = (b & 0x38) >> 3; // ws

    win.penStyle = b & 0x07; // ps
    // The spec says there are (rowCount+1) "virtual rows"

    win.virtualRowCount = win.rowCount + 1;
    return i;
  };
  /**
   * Parse and execute the SWA command.
   *
   * Set attributes of the current window.
   *
   * @param  {Integer} i        Current index in the 708 packet
   * @param  {Service} service  The service object to be affected
   * @return {Integer}          New index after parsing
   */


  Cea708Stream.prototype.setWindowAttributes = function (i, service) {
    var packetData = this.current708Packet.data;
    var b = packetData[i];
    var winAttr = service.currentWindow.winAttr;
    b = packetData[++i];
    winAttr.fillOpacity = (b & 0xc0) >> 6; // fo

    winAttr.fillRed = (b & 0x30) >> 4; // fr

    winAttr.fillGreen = (b & 0x0c) >> 2; // fg

    winAttr.fillBlue = b & 0x03; // fb

    b = packetData[++i];
    winAttr.borderType = (b & 0xc0) >> 6; // bt

    winAttr.borderRed = (b & 0x30) >> 4; // br

    winAttr.borderGreen = (b & 0x0c) >> 2; // bg

    winAttr.borderBlue = b & 0x03; // bb

    b = packetData[++i];
    winAttr.borderType += (b & 0x80) >> 5; // bt

    winAttr.wordWrap = (b & 0x40) >> 6; // ww

    winAttr.printDirection = (b & 0x30) >> 4; // pd

    winAttr.scrollDirection = (b & 0x0c) >> 2; // sd

    winAttr.justify = b & 0x03; // j

    b = packetData[++i];
    winAttr.effectSpeed = (b & 0xf0) >> 4; // es

    winAttr.effectDirection = (b & 0x0c) >> 2; // ed

    winAttr.displayEffect = b & 0x03; // de

    return i;
  };
  /**
   * Gather text from all displayed windows and push a caption to output.
   *
   * @param  {Integer} i        Current index in the 708 packet
   * @param  {Service} service  The service object to be affected
   */


  Cea708Stream.prototype.flushDisplayed = function (pts, service) {
    var displayedText = []; // TODO: Positioning not supported, displaying multiple windows will not necessarily
    // display text in the correct order, but sample files so far have not shown any issue.

    for (var winId = 0; winId < 8; winId++) {
      if (service.windows[winId].visible && !service.windows[winId].isEmpty()) {
        displayedText.push(service.windows[winId].getText());
      }
    }

    service.endPts = pts;
    service.text = displayedText.join('\n\n');
    this.pushCaption(service);
    service.startPts = pts;
  };
  /**
   * Push a caption to output if the caption contains text.
   *
   * @param  {Service} service  The service object to be affected
   */


  Cea708Stream.prototype.pushCaption = function (service) {
    if (service.text !== '') {
      this.trigger('data', {
        startPts: service.startPts,
        endPts: service.endPts,
        text: service.text,
        stream: 'cc708_' + service.serviceNum
      });
      service.text = '';
      service.startPts = service.endPts;
    }
  };
  /**
   * Parse and execute the DSW command.
   *
   * Set visible property of windows based on the parsed bitmask.
   *
   * @param  {Integer} i        Current index in the 708 packet
   * @param  {Service} service  The service object to be affected
   * @return {Integer}          New index after parsing
   */


  Cea708Stream.prototype.displayWindows = function (i, service) {
    var packetData = this.current708Packet.data;
    var b = packetData[++i];
    var pts = this.getPts(i);
    this.flushDisplayed(pts, service);

    for (var winId = 0; winId < 8; winId++) {
      if (b & 0x01 << winId) {
        service.windows[winId].visible = 1;
      }
    }

    return i;
  };
  /**
   * Parse and execute the HDW command.
   *
   * Set visible property of windows based on the parsed bitmask.
   *
   * @param  {Integer} i        Current index in the 708 packet
   * @param  {Service} service  The service object to be affected
   * @return {Integer}          New index after parsing
   */


  Cea708Stream.prototype.hideWindows = function (i, service) {
    var packetData = this.current708Packet.data;
    var b = packetData[++i];
    var pts = this.getPts(i);
    this.flushDisplayed(pts, service);

    for (var winId = 0; winId < 8; winId++) {
      if (b & 0x01 << winId) {
        service.windows[winId].visible = 0;
      }
    }

    return i;
  };
  /**
   * Parse and execute the TGW command.
   *
   * Set visible property of windows based on the parsed bitmask.
   *
   * @param  {Integer} i        Current index in the 708 packet
   * @param  {Service} service  The service object to be affected
   * @return {Integer}          New index after parsing
   */


  Cea708Stream.prototype.toggleWindows = function (i, service) {
    var packetData = this.current708Packet.data;
    var b = packetData[++i];
    var pts = this.getPts(i);
    this.flushDisplayed(pts, service);

    for (var winId = 0; winId < 8; winId++) {
      if (b & 0x01 << winId) {
        service.windows[winId].visible ^= 1;
      }
    }

    return i;
  };
  /**
   * Parse and execute the CLW command.
   *
   * Clear text of windows based on the parsed bitmask.
   *
   * @param  {Integer} i        Current index in the 708 packet
   * @param  {Service} service  The service object to be affected
   * @return {Integer}          New index after parsing
   */


  Cea708Stream.prototype.clearWindows = function (i, service) {
    var packetData = this.current708Packet.data;
    var b = packetData[++i];
    var pts = this.getPts(i);
    this.flushDisplayed(pts, service);

    for (var winId = 0; winId < 8; winId++) {
      if (b & 0x01 << winId) {
        service.windows[winId].clearText();
      }
    }

    return i;
  };
  /**
   * Parse and execute the DLW command.
   *
   * Re-initialize windows based on the parsed bitmask.
   *
   * @param  {Integer} i        Current index in the 708 packet
   * @param  {Service} service  The service object to be affected
   * @return {Integer}          New index after parsing
   */


  Cea708Stream.prototype.deleteWindows = function (i, service) {
    var packetData = this.current708Packet.data;
    var b = packetData[++i];
    var pts = this.getPts(i);
    this.flushDisplayed(pts, service);

    for (var winId = 0; winId < 8; winId++) {
      if (b & 0x01 << winId) {
        service.windows[winId].reset();
      }
    }

    return i;
  };
  /**
   * Parse and execute the SPA command.
   *
   * Set pen attributes of the current window.
   *
   * @param  {Integer} i        Current index in the 708 packet
   * @param  {Service} service  The service object to be affected
   * @return {Integer}          New index after parsing
   */


  Cea708Stream.prototype.setPenAttributes = function (i, service) {
    var packetData = this.current708Packet.data;
    var b = packetData[i];
    var penAttr = service.currentWindow.penAttr;
    b = packetData[++i];
    penAttr.textTag = (b & 0xf0) >> 4; // tt

    penAttr.offset = (b & 0x0c) >> 2; // o

    penAttr.penSize = b & 0x03; // s

    b = packetData[++i];
    penAttr.italics = (b & 0x80) >> 7; // i

    penAttr.underline = (b & 0x40) >> 6; // u

    penAttr.edgeType = (b & 0x38) >> 3; // et

    penAttr.fontStyle = b & 0x07; // fs

    return i;
  };
  /**
   * Parse and execute the SPC command.
   *
   * Set pen color of the current window.
   *
   * @param  {Integer} i        Current index in the 708 packet
   * @param  {Service} service  The service object to be affected
   * @return {Integer}          New index after parsing
   */


  Cea708Stream.prototype.setPenColor = function (i, service) {
    var packetData = this.current708Packet.data;
    var b = packetData[i];
    var penColor = service.currentWindow.penColor;
    b = packetData[++i];
    penColor.fgOpacity = (b & 0xc0) >> 6; // fo

    penColor.fgRed = (b & 0x30) >> 4; // fr

    penColor.fgGreen = (b & 0x0c) >> 2; // fg

    penColor.fgBlue = b & 0x03; // fb

    b = packetData[++i];
    penColor.bgOpacity = (b & 0xc0) >> 6; // bo

    penColor.bgRed = (b & 0x30) >> 4; // br

    penColor.bgGreen = (b & 0x0c) >> 2; // bg

    penColor.bgBlue = b & 0x03; // bb

    b = packetData[++i];
    penColor.edgeRed = (b & 0x30) >> 4; // er

    penColor.edgeGreen = (b & 0x0c) >> 2; // eg

    penColor.edgeBlue = b & 0x03; // eb

    return i;
  };
  /**
   * Parse and execute the SPL command.
   *
   * Set pen location of the current window.
   *
   * @param  {Integer} i        Current index in the 708 packet
   * @param  {Service} service  The service object to be affected
   * @return {Integer}          New index after parsing
   */


  Cea708Stream.prototype.setPenLocation = function (i, service) {
    var packetData = this.current708Packet.data;
    var b = packetData[i];
    var penLoc = service.currentWindow.penLoc; // Positioning isn't really supported at the moment, so this essentially just inserts a linebreak

    service.currentWindow.pendingNewLine = true;
    b = packetData[++i];
    penLoc.row = b & 0x0f; // r

    b = packetData[++i];
    penLoc.column = b & 0x3f; // c

    return i;
  };
  /**
   * Execute the RST command.
   *
   * Reset service to a clean slate. Re-initialize.
   *
   * @param  {Integer} i        Current index in the 708 packet
   * @param  {Service} service  The service object to be affected
   * @return {Service}          Re-initialized service
   */


  Cea708Stream.prototype.reset = function (i, service) {
    var pts = this.getPts(i);
    this.flushDisplayed(pts, service);
    return this.initService(service.serviceNum, i);
  }; // This hash maps non-ASCII, special, and extended character codes to their
  // proper Unicode equivalent. The first keys that are only a single byte
  // are the non-standard ASCII characters, which simply map the CEA608 byte
  // to the standard ASCII/Unicode. The two-byte keys that follow are the CEA608
  // character codes, but have their MSB bitmasked with 0x03 so that a lookup
  // can be performed regardless of the field and data channel on which the
  // character code was received.


  var CHARACTER_TRANSLATION = {
    0x2a: 0xe1,
    // á
    0x5c: 0xe9,
    // é
    0x5e: 0xed,
    // í
    0x5f: 0xf3,
    // ó
    0x60: 0xfa,
    // ú
    0x7b: 0xe7,
    // ç
    0x7c: 0xf7,
    // ÷
    0x7d: 0xd1,
    // Ñ
    0x7e: 0xf1,
    // ñ
    0x7f: 0x2588,
    // █
    0x0130: 0xae,
    // ®
    0x0131: 0xb0,
    // °
    0x0132: 0xbd,
    // ½
    0x0133: 0xbf,
    // ¿
    0x0134: 0x2122,
    // ™
    0x0135: 0xa2,
    // ¢
    0x0136: 0xa3,
    // £
    0x0137: 0x266a,
    // ♪
    0x0138: 0xe0,
    // à
    0x0139: 0xa0,
    //
    0x013a: 0xe8,
    // è
    0x013b: 0xe2,
    // â
    0x013c: 0xea,
    // ê
    0x013d: 0xee,
    // î
    0x013e: 0xf4,
    // ô
    0x013f: 0xfb,
    // û
    0x0220: 0xc1,
    // Á
    0x0221: 0xc9,
    // É
    0x0222: 0xd3,
    // Ó
    0x0223: 0xda,
    // Ú
    0x0224: 0xdc,
    // Ü
    0x0225: 0xfc,
    // ü
    0x0226: 0x2018,
    // ‘
    0x0227: 0xa1,
    // ¡
    0x0228: 0x2a,
    // *
    0x0229: 0x27,
    // '
    0x022a: 0x2014,
    // —
    0x022b: 0xa9,
    // ©
    0x022c: 0x2120,
    // ℠
    0x022d: 0x2022,
    // •
    0x022e: 0x201c,
    // “
    0x022f: 0x201d,
    // ”
    0x0230: 0xc0,
    // À
    0x0231: 0xc2,
    // Â
    0x0232: 0xc7,
    // Ç
    0x0233: 0xc8,
    // È
    0x0234: 0xca,
    // Ê
    0x0235: 0xcb,
    // Ë
    0x0236: 0xeb,
    // ë
    0x0237: 0xce,
    // Î
    0x0238: 0xcf,
    // Ï
    0x0239: 0xef,
    // ï
    0x023a: 0xd4,
    // Ô
    0x023b: 0xd9,
    // Ù
    0x023c: 0xf9,
    // ù
    0x023d: 0xdb,
    // Û
    0x023e: 0xab,
    // «
    0x023f: 0xbb,
    // »
    0x0320: 0xc3,
    // Ã
    0x0321: 0xe3,
    // ã
    0x0322: 0xcd,
    // Í
    0x0323: 0xcc,
    // Ì
    0x0324: 0xec,
    // ì
    0x0325: 0xd2,
    // Ò
    0x0326: 0xf2,
    // ò
    0x0327: 0xd5,
    // Õ
    0x0328: 0xf5,
    // õ
    0x0329: 0x7b,
    // {
    0x032a: 0x7d,
    // }
    0x032b: 0x5c,
    // \
    0x032c: 0x5e,
    // ^
    0x032d: 0x5f,
    // _
    0x032e: 0x7c,
    // |
    0x032f: 0x7e,
    // ~
    0x0330: 0xc4,
    // Ä
    0x0331: 0xe4,
    // ä
    0x0332: 0xd6,
    // Ö
    0x0333: 0xf6,
    // ö
    0x0334: 0xdf,
    // ß
    0x0335: 0xa5,
    // ¥
    0x0336: 0xa4,
    // ¤
    0x0337: 0x2502,
    // │
    0x0338: 0xc5,
    // Å
    0x0339: 0xe5,
    // å
    0x033a: 0xd8,
    // Ø
    0x033b: 0xf8,
    // ø
    0x033c: 0x250c,
    // ┌
    0x033d: 0x2510,
    // ┐
    0x033e: 0x2514,
    // └
    0x033f: 0x2518 // ┘

  };

  var getCharFromCode = function (code) {
    if (code === null) {
      return '';
    }

    code = CHARACTER_TRANSLATION[code] || code;
    return String.fromCharCode(code);
  }; // the index of the last row in a CEA-608 display buffer


  var BOTTOM_ROW = 14; // This array is used for mapping PACs -> row #, since there's no way of
  // getting it through bit logic.

  var ROWS = [0x1100, 0x1120, 0x1200, 0x1220, 0x1500, 0x1520, 0x1600, 0x1620, 0x1700, 0x1720, 0x1000, 0x1300, 0x1320, 0x1400, 0x1420]; // CEA-608 captions are rendered onto a 34x15 matrix of character
  // cells. The "bottom" row is the last element in the outer array.
  // We keep track of positioning information as we go by storing the
  // number of indentations and the tab offset in this buffer.

  var createDisplayBuffer = function () {
    var result = [],
        i = BOTTOM_ROW + 1;

    while (i--) {
      result.push({
        text: '',
        indent: 0,
        offset: 0
      });
    }

    return result;
  };

  var Cea608Stream = function (field, dataChannel) {
    Cea608Stream.prototype.init.call(this);
    this.field_ = field || 0;
    this.dataChannel_ = dataChannel || 0;
    this.name_ = 'CC' + ((this.field_ << 1 | this.dataChannel_) + 1);
    this.setConstants();
    this.reset();

    this.push = function (packet) {
      var data, swap, char0, char1, text; // remove the parity bits

      data = packet.ccData & 0x7f7f; // ignore duplicate control codes; the spec demands they're sent twice

      if (data === this.lastControlCode_) {
        this.lastControlCode_ = null;
        return;
      } // Store control codes


      if ((data & 0xf000) === 0x1000) {
        this.lastControlCode_ = data;
      } else if (data !== this.PADDING_) {
        this.lastControlCode_ = null;
      }

      char0 = data >>> 8;
      char1 = data & 0xff;

      if (data === this.PADDING_) {
        return;
      } else if (data === this.RESUME_CAPTION_LOADING_) {
        this.mode_ = 'popOn';
      } else if (data === this.END_OF_CAPTION_) {
        // If an EOC is received while in paint-on mode, the displayed caption
        // text should be swapped to non-displayed memory as if it was a pop-on
        // caption. Because of that, we should explicitly switch back to pop-on
        // mode
        this.mode_ = 'popOn';
        this.clearFormatting(packet.pts); // if a caption was being displayed, it's gone now

        this.flushDisplayed(packet.pts); // flip memory

        swap = this.displayed_;
        this.displayed_ = this.nonDisplayed_;
        this.nonDisplayed_ = swap; // start measuring the time to display the caption

        this.startPts_ = packet.pts;
      } else if (data === this.ROLL_UP_2_ROWS_) {
        this.rollUpRows_ = 2;
        this.setRollUp(packet.pts);
      } else if (data === this.ROLL_UP_3_ROWS_) {
        this.rollUpRows_ = 3;
        this.setRollUp(packet.pts);
      } else if (data === this.ROLL_UP_4_ROWS_) {
        this.rollUpRows_ = 4;
        this.setRollUp(packet.pts);
      } else if (data === this.CARRIAGE_RETURN_) {
        this.clearFormatting(packet.pts);
        this.flushDisplayed(packet.pts);
        this.shiftRowsUp_();
        this.startPts_ = packet.pts;
      } else if (data === this.BACKSPACE_) {
        if (this.mode_ === 'popOn') {
          this.nonDisplayed_[this.row_].text = this.nonDisplayed_[this.row_].text.slice(0, -1);
        } else {
          this.displayed_[this.row_].text = this.displayed_[this.row_].text.slice(0, -1);
        }
      } else if (data === this.ERASE_DISPLAYED_MEMORY_) {
        this.flushDisplayed(packet.pts);
        this.displayed_ = createDisplayBuffer();
      } else if (data === this.ERASE_NON_DISPLAYED_MEMORY_) {
        this.nonDisplayed_ = createDisplayBuffer();
      } else if (data === this.RESUME_DIRECT_CAPTIONING_) {
        if (this.mode_ !== 'paintOn') {
          // NOTE: This should be removed when proper caption positioning is
          // implemented
          this.flushDisplayed(packet.pts);
          this.displayed_ = createDisplayBuffer();
        }

        this.mode_ = 'paintOn';
        this.startPts_ = packet.pts; // Append special characters to caption text
      } else if (this.isSpecialCharacter(char0, char1)) {
        // Bitmask char0 so that we can apply character transformations
        // regardless of field and data channel.
        // Then byte-shift to the left and OR with char1 so we can pass the
        // entire character code to `getCharFromCode`.
        char0 = (char0 & 0x03) << 8;
        text = getCharFromCode(char0 | char1);
        this[this.mode_](packet.pts, text);
        this.column_++; // Append extended characters to caption text
      } else if (this.isExtCharacter(char0, char1)) {
        // Extended characters always follow their "non-extended" equivalents.
        // IE if a "è" is desired, you'll always receive "eè"; non-compliant
        // decoders are supposed to drop the "è", while compliant decoders
        // backspace the "e" and insert "è".
        // Delete the previous character
        if (this.mode_ === 'popOn') {
          this.nonDisplayed_[this.row_].text = this.nonDisplayed_[this.row_].text.slice(0, -1);
        } else {
          this.displayed_[this.row_].text = this.displayed_[this.row_].text.slice(0, -1);
        } // Bitmask char0 so that we can apply character transformations
        // regardless of field and data channel.
        // Then byte-shift to the left and OR with char1 so we can pass the
        // entire character code to `getCharFromCode`.


        char0 = (char0 & 0x03) << 8;
        text = getCharFromCode(char0 | char1);
        this[this.mode_](packet.pts, text);
        this.column_++; // Process mid-row codes
      } else if (this.isMidRowCode(char0, char1)) {
        // Attributes are not additive, so clear all formatting
        this.clearFormatting(packet.pts); // According to the standard, mid-row codes
        // should be replaced with spaces, so add one now

        this[this.mode_](packet.pts, ' ');
        this.column_++;

        if ((char1 & 0xe) === 0xe) {
          this.addFormatting(packet.pts, ['i']);
        }

        if ((char1 & 0x1) === 0x1) {
          this.addFormatting(packet.pts, ['u']);
        } // Detect offset control codes and adjust cursor

      } else if (this.isOffsetControlCode(char0, char1)) {
        // Cursor position is set by indent PAC (see below) in 4-column
        // increments, with an additional offset code of 1-3 to reach any
        // of the 32 columns specified by CEA-608. So all we need to do
        // here is increment the column cursor by the given offset.
        const offset = char1 & 0x03; // For an offest value 1-3, set the offset for that caption
        // in the non-displayed array.

        this.nonDisplayed_[this.row_].offset = offset;
        this.column_ += offset; // Detect PACs (Preamble Address Codes)
      } else if (this.isPAC(char0, char1)) {
        // There's no logic for PAC -> row mapping, so we have to just
        // find the row code in an array and use its index :(
        var row = ROWS.indexOf(data & 0x1f20); // Configure the caption window if we're in roll-up mode

        if (this.mode_ === 'rollUp') {
          // This implies that the base row is incorrectly set.
          // As per the recommendation in CEA-608(Base Row Implementation), defer to the number
          // of roll-up rows set.
          if (row - this.rollUpRows_ + 1 < 0) {
            row = this.rollUpRows_ - 1;
          }

          this.setRollUp(packet.pts, row);
        }

        if (row !== this.row_) {
          // formatting is only persistent for current row
          this.clearFormatting(packet.pts);
          this.row_ = row;
        } // All PACs can apply underline, so detect and apply
        // (All odd-numbered second bytes set underline)


        if (char1 & 0x1 && this.formatting_.indexOf('u') === -1) {
          this.addFormatting(packet.pts, ['u']);
        }

        if ((data & 0x10) === 0x10) {
          // We've got an indent level code. Each successive even number
          // increments the column cursor by 4, so we can get the desired
          // column position by bit-shifting to the right (to get n/2)
          // and multiplying by 4.
          const indentations = (data & 0xe) >> 1;
          this.column_ = indentations * 4; // add to the number of indentations for positioning

          this.nonDisplayed_[this.row_].indent += indentations;
        }

        if (this.isColorPAC(char1)) {
          // it's a color code, though we only support white, which
          // can be either normal or italicized. white italics can be
          // either 0x4e or 0x6e depending on the row, so we just
          // bitwise-and with 0xe to see if italics should be turned on
          if ((char1 & 0xe) === 0xe) {
            this.addFormatting(packet.pts, ['i']);
          }
        } // We have a normal character in char0, and possibly one in char1

      } else if (this.isNormalChar(char0)) {
        if (char1 === 0x00) {
          char1 = null;
        }

        text = getCharFromCode(char0);
        text += getCharFromCode(char1);
        this[this.mode_](packet.pts, text);
        this.column_ += text.length;
      } // finish data processing

    };
  };

  Cea608Stream.prototype = new Stream$7(); // Trigger a cue point that captures the current state of the
  // display buffer

  Cea608Stream.prototype.flushDisplayed = function (pts) {
    const logWarning = index => {
      this.trigger('log', {
        level: 'warn',
        message: 'Skipping a malformed 608 caption at index ' + index + '.'
      });
    };

    const content = [];
    this.displayed_.forEach((row, i) => {
      if (row && row.text && row.text.length) {
        try {
          // remove spaces from the start and end of the string
          row.text = row.text.trim();
        } catch (e) {
          // Ordinarily, this shouldn't happen. However, caption
          // parsing errors should not throw exceptions and
          // break playback.
          logWarning(i);
        } // See the below link for more details on the following fields:
        // https://dvcs.w3.org/hg/text-tracks/raw-file/default/608toVTT/608toVTT.html#positioning-in-cea-608


        if (row.text.length) {
          content.push({
            // The text to be displayed in the caption from this specific row, with whitespace removed.
            text: row.text,
            // Value between 1 and 15 representing the PAC row used to calculate line height.
            line: i + 1,
            // A number representing the indent position by percentage (CEA-608 PAC indent code).
            // The value will be a number between 10 and 80. Offset is used to add an aditional
            // value to the position if necessary.
            position: 10 + Math.min(70, row.indent * 10) + row.offset * 2.5
          });
        }
      } else if (row === undefined || row === null) {
        logWarning(i);
      }
    });

    if (content.length) {
      this.trigger('data', {
        startPts: this.startPts_,
        endPts: pts,
        content,
        stream: this.name_
      });
    }
  };
  /**
   * Zero out the data, used for startup and on seek
   */


  Cea608Stream.prototype.reset = function () {
    this.mode_ = 'popOn'; // When in roll-up mode, the index of the last row that will
    // actually display captions. If a caption is shifted to a row
    // with a lower index than this, it is cleared from the display
    // buffer

    this.topRow_ = 0;
    this.startPts_ = 0;
    this.displayed_ = createDisplayBuffer();
    this.nonDisplayed_ = createDisplayBuffer();
    this.lastControlCode_ = null; // Track row and column for proper line-breaking and spacing

    this.column_ = 0;
    this.row_ = BOTTOM_ROW;
    this.rollUpRows_ = 2; // This variable holds currently-applied formatting

    this.formatting_ = [];
  };
  /**
   * Sets up control code and related constants for this instance
   */


  Cea608Stream.prototype.setConstants = function () {
    // The following attributes have these uses:
    // ext_ :    char0 for mid-row codes, and the base for extended
    //           chars (ext_+0, ext_+1, and ext_+2 are char0s for
    //           extended codes)
    // control_: char0 for control codes, except byte-shifted to the
    //           left so that we can do this.control_ | CONTROL_CODE
    // offset_:  char0 for tab offset codes
    //
    // It's also worth noting that control codes, and _only_ control codes,
    // differ between field 1 and field2. Field 2 control codes are always
    // their field 1 value plus 1. That's why there's the "| field" on the
    // control value.
    if (this.dataChannel_ === 0) {
      this.BASE_ = 0x10;
      this.EXT_ = 0x11;
      this.CONTROL_ = (0x14 | this.field_) << 8;
      this.OFFSET_ = 0x17;
    } else if (this.dataChannel_ === 1) {
      this.BASE_ = 0x18;
      this.EXT_ = 0x19;
      this.CONTROL_ = (0x1c | this.field_) << 8;
      this.OFFSET_ = 0x1f;
    } // Constants for the LSByte command codes recognized by Cea608Stream. This
    // list is not exhaustive. For a more comprehensive listing and semantics see
    // http://www.gpo.gov/fdsys/pkg/CFR-2010-title47-vol1/pdf/CFR-2010-title47-vol1-sec15-119.pdf
    // Padding


    this.PADDING_ = 0x0000; // Pop-on Mode

    this.RESUME_CAPTION_LOADING_ = this.CONTROL_ | 0x20;
    this.END_OF_CAPTION_ = this.CONTROL_ | 0x2f; // Roll-up Mode

    this.ROLL_UP_2_ROWS_ = this.CONTROL_ | 0x25;
    this.ROLL_UP_3_ROWS_ = this.CONTROL_ | 0x26;
    this.ROLL_UP_4_ROWS_ = this.CONTROL_ | 0x27;
    this.CARRIAGE_RETURN_ = this.CONTROL_ | 0x2d; // paint-on mode

    this.RESUME_DIRECT_CAPTIONING_ = this.CONTROL_ | 0x29; // Erasure

    this.BACKSPACE_ = this.CONTROL_ | 0x21;
    this.ERASE_DISPLAYED_MEMORY_ = this.CONTROL_ | 0x2c;
    this.ERASE_NON_DISPLAYED_MEMORY_ = this.CONTROL_ | 0x2e;
  };
  /**
   * Detects if the 2-byte packet data is a special character
   *
   * Special characters have a second byte in the range 0x30 to 0x3f,
   * with the first byte being 0x11 (for data channel 1) or 0x19 (for
   * data channel 2).
   *
   * @param  {Integer} char0 The first byte
   * @param  {Integer} char1 The second byte
   * @return {Boolean}       Whether the 2 bytes are an special character
   */


  Cea608Stream.prototype.isSpecialCharacter = function (char0, char1) {
    return char0 === this.EXT_ && char1 >= 0x30 && char1 <= 0x3f;
  };
  /**
   * Detects if the 2-byte packet data is an extended character
   *
   * Extended characters have a second byte in the range 0x20 to 0x3f,
   * with the first byte being 0x12 or 0x13 (for data channel 1) or
   * 0x1a or 0x1b (for data channel 2).
   *
   * @param  {Integer} char0 The first byte
   * @param  {Integer} char1 The second byte
   * @return {Boolean}       Whether the 2 bytes are an extended character
   */


  Cea608Stream.prototype.isExtCharacter = function (char0, char1) {
    return (char0 === this.EXT_ + 1 || char0 === this.EXT_ + 2) && char1 >= 0x20 && char1 <= 0x3f;
  };
  /**
   * Detects if the 2-byte packet is a mid-row code
   *
   * Mid-row codes have a second byte in the range 0x20 to 0x2f, with
   * the first byte being 0x11 (for data channel 1) or 0x19 (for data
   * channel 2).
   *
   * @param  {Integer} char0 The first byte
   * @param  {Integer} char1 The second byte
   * @return {Boolean}       Whether the 2 bytes are a mid-row code
   */


  Cea608Stream.prototype.isMidRowCode = function (char0, char1) {
    return char0 === this.EXT_ && char1 >= 0x20 && char1 <= 0x2f;
  };
  /**
   * Detects if the 2-byte packet is an offset control code
   *
   * Offset control codes have a second byte in the range 0x21 to 0x23,
   * with the first byte being 0x17 (for data channel 1) or 0x1f (for
   * data channel 2).
   *
   * @param  {Integer} char0 The first byte
   * @param  {Integer} char1 The second byte
   * @return {Boolean}       Whether the 2 bytes are an offset control code
   */


  Cea608Stream.prototype.isOffsetControlCode = function (char0, char1) {
    return char0 === this.OFFSET_ && char1 >= 0x21 && char1 <= 0x23;
  };
  /**
   * Detects if the 2-byte packet is a Preamble Address Code
   *
   * PACs have a first byte in the range 0x10 to 0x17 (for data channel 1)
   * or 0x18 to 0x1f (for data channel 2), with the second byte in the
   * range 0x40 to 0x7f.
   *
   * @param  {Integer} char0 The first byte
   * @param  {Integer} char1 The second byte
   * @return {Boolean}       Whether the 2 bytes are a PAC
   */


  Cea608Stream.prototype.isPAC = function (char0, char1) {
    return char0 >= this.BASE_ && char0 < this.BASE_ + 8 && char1 >= 0x40 && char1 <= 0x7f;
  };
  /**
   * Detects if a packet's second byte is in the range of a PAC color code
   *
   * PAC color codes have the second byte be in the range 0x40 to 0x4f, or
   * 0x60 to 0x6f.
   *
   * @param  {Integer} char1 The second byte
   * @return {Boolean}       Whether the byte is a color PAC
   */


  Cea608Stream.prototype.isColorPAC = function (char1) {
    return char1 >= 0x40 && char1 <= 0x4f || char1 >= 0x60 && char1 <= 0x7f;
  };
  /**
   * Detects if a single byte is in the range of a normal character
   *
   * Normal text bytes are in the range 0x20 to 0x7f.
   *
   * @param  {Integer} char  The byte
   * @return {Boolean}       Whether the byte is a normal character
   */


  Cea608Stream.prototype.isNormalChar = function (char) {
    return char >= 0x20 && char <= 0x7f;
  };
  /**
   * Configures roll-up
   *
   * @param  {Integer} pts         Current PTS
   * @param  {Integer} newBaseRow  Used by PACs to slide the current window to
   *                               a new position
   */


  Cea608Stream.prototype.setRollUp = function (pts, newBaseRow) {
    // Reset the base row to the bottom row when switching modes
    if (this.mode_ !== 'rollUp') {
      this.row_ = BOTTOM_ROW;
      this.mode_ = 'rollUp'; // Spec says to wipe memories when switching to roll-up

      this.flushDisplayed(pts);
      this.nonDisplayed_ = createDisplayBuffer();
      this.displayed_ = createDisplayBuffer();
    }

    if (newBaseRow !== undefined && newBaseRow !== this.row_) {
      // move currently displayed captions (up or down) to the new base row
      for (var i = 0; i < this.rollUpRows_; i++) {
        this.displayed_[newBaseRow - i] = this.displayed_[this.row_ - i];
        this.displayed_[this.row_ - i] = {
          text: '',
          indent: 0,
          offset: 0
        };
      }
    }

    if (newBaseRow === undefined) {
      newBaseRow = this.row_;
    }

    this.topRow_ = newBaseRow - this.rollUpRows_ + 1;
  }; // Adds the opening HTML tag for the passed character to the caption text,
  // and keeps track of it for later closing


  Cea608Stream.prototype.addFormatting = function (pts, format) {
    this.formatting_ = this.formatting_.concat(format);
    var text = format.reduce(function (text, format) {
      return text + '<' + format + '>';
    }, '');
    this[this.mode_](pts, text);
  }; // Adds HTML closing tags for current formatting to caption text and
  // clears remembered formatting


  Cea608Stream.prototype.clearFormatting = function (pts) {
    if (!this.formatting_.length) {
      return;
    }

    var text = this.formatting_.reverse().reduce(function (text, format) {
      return text + '</' + format + '>';
    }, '');
    this.formatting_ = [];
    this[this.mode_](pts, text);
  }; // Mode Implementations


  Cea608Stream.prototype.popOn = function (pts, text) {
    var baseRow = this.nonDisplayed_[this.row_].text; // buffer characters

    baseRow += text;
    this.nonDisplayed_[this.row_].text = baseRow;
  };

  Cea608Stream.prototype.rollUp = function (pts, text) {
    var baseRow = this.displayed_[this.row_].text;
    baseRow += text;
    this.displayed_[this.row_].text = baseRow;
  };

  Cea608Stream.prototype.shiftRowsUp_ = function () {
    var i; // clear out inactive rows

    for (i = 0; i < this.topRow_; i++) {
      this.displayed_[i] = {
        text: '',
        indent: 0,
        offset: 0
      };
    }

    for (i = this.row_ + 1; i < BOTTOM_ROW + 1; i++) {
      this.displayed_[i] = {
        text: '',
        indent: 0,
        offset: 0
      };
    } // shift displayed rows up


    for (i = this.topRow_; i < this.row_; i++) {
      this.displayed_[i] = this.displayed_[i + 1];
    } // clear out the bottom row


    this.displayed_[this.row_] = {
      text: '',
      indent: 0,
      offset: 0
    };
  };

  Cea608Stream.prototype.paintOn = function (pts, text) {
    var baseRow = this.displayed_[this.row_].text;
    baseRow += text;
    this.displayed_[this.row_].text = baseRow;
  }; // exports


  var captionStream = {
    CaptionStream: CaptionStream$2,
    Cea608Stream: Cea608Stream,
    Cea708Stream: Cea708Stream
  };
  /**
   * mux.js
   *
   * Copyright (c) Brightcove
   * Licensed Apache-2.0 https://github.com/videojs/mux.js/blob/master/LICENSE
   */

  var streamTypes = {
    H264_STREAM_TYPE: 0x1B,
    ADTS_STREAM_TYPE: 0x0F,
    METADATA_STREAM_TYPE: 0x15
  };
  /**
   * mux.js
   *
   * Copyright (c) Brightcove
   * Licensed Apache-2.0 https://github.com/videojs/mux.js/blob/master/LICENSE
   *
   * Accepts program elementary stream (PES) data events and corrects
   * decode and presentation time stamps to account for a rollover
   * of the 33 bit value.
   */

  var Stream$6 = stream;
  var MAX_TS = 8589934592;
  var RO_THRESH = 4294967296;
  var TYPE_SHARED = 'shared';

  var handleRollover$1 = function (value, reference) {
    var direction = 1;

    if (value > reference) {
      // If the current timestamp value is greater than our reference timestamp and we detect a
      // timestamp rollover, this means the roll over is happening in the opposite direction.
      // Example scenario: Enter a long stream/video just after a rollover occurred. The reference
      // point will be set to a small number, e.g. 1. The user then seeks backwards over the
      // rollover point. In loading this segment, the timestamp values will be very large,
      // e.g. 2^33 - 1. Since this comes before the data we loaded previously, we want to adjust
      // the time stamp to be `value - 2^33`.
      direction = -1;
    } // Note: A seek forwards or back that is greater than the RO_THRESH (2^32, ~13 hours) will
    // cause an incorrect adjustment.


    while (Math.abs(reference - value) > RO_THRESH) {
      value += direction * MAX_TS;
    }

    return value;
  };

  var TimestampRolloverStream$1 = function (type) {
    var lastDTS, referenceDTS;
    TimestampRolloverStream$1.prototype.init.call(this); // The "shared" type is used in cases where a stream will contain muxed
    // video and audio. We could use `undefined` here, but having a string
    // makes debugging a little clearer.

    this.type_ = type || TYPE_SHARED;

    this.push = function (data) {
      /**
       * Rollover stream expects data from elementary stream.
       * Elementary stream can push forward 2 types of data
       * - Parsed Video/Audio/Timed-metadata PES (packetized elementary stream) packets
       * - Tracks metadata from PMT (Program Map Table)
       * Rollover stream expects pts/dts info to be available, since it stores lastDTS
       * We should ignore non-PES packets since they may override lastDTS to undefined.
       * lastDTS is important to signal the next segments
       * about rollover from the previous segments.
       */
      if (data.type === 'metadata') {
        this.trigger('data', data);
        return;
      } // Any "shared" rollover streams will accept _all_ data. Otherwise,
      // streams will only accept data that matches their type.


      if (this.type_ !== TYPE_SHARED && data.type !== this.type_) {
        return;
      }

      if (referenceDTS === undefined) {
        referenceDTS = data.dts;
      }

      data.dts = handleRollover$1(data.dts, referenceDTS);
      data.pts = handleRollover$1(data.pts, referenceDTS);
      lastDTS = data.dts;
      this.trigger('data', data);
    };

    this.flush = function () {
      referenceDTS = lastDTS;
      this.trigger('done');
    };

    this.endTimeline = function () {
      this.flush();
      this.trigger('endedtimeline');
    };

    this.discontinuity = function () {
      referenceDTS = void 0;
      lastDTS = void 0;
    };

    this.reset = function () {
      this.discontinuity();
      this.trigger('reset');
    };
  };

  TimestampRolloverStream$1.prototype = new Stream$6();
  var timestampRolloverStream = {
    TimestampRolloverStream: TimestampRolloverStream$1,
    handleRollover: handleRollover$1
  }; // Once IE11 support is dropped, this function should be removed.

  var typedArrayIndexOf$1 = (typedArray, element, fromIndex) => {
    if (!typedArray) {
      return -1;
    }

    var currentIndex = fromIndex;

    for (; currentIndex < typedArray.length; currentIndex++) {
      if (typedArray[currentIndex] === element) {
        return currentIndex;
      }
    }

    return -1;
  };

  var typedArray = {
    typedArrayIndexOf: typedArrayIndexOf$1
  };
  /**
   * mux.js
   *
   * Copyright (c) Brightcove
   * Licensed Apache-2.0 https://github.com/videojs/mux.js/blob/master/LICENSE
   *
   * Tools for parsing ID3 frame data
   * @see http://id3.org/id3v2.3.0
   */

  var typedArrayIndexOf = typedArray.typedArrayIndexOf,
      // Frames that allow different types of text encoding contain a text
  // encoding description byte [ID3v2.4.0 section 4.]
  textEncodingDescriptionByte = {
    Iso88591: 0x00,
    // ISO-8859-1, terminated with \0.
    Utf16: 0x01,
    // UTF-16 encoded Unicode BOM, terminated with \0\0
    Utf16be: 0x02,
    // UTF-16BE encoded Unicode, without BOM, terminated with \0\0
    Utf8: 0x03 // UTF-8 encoded Unicode, terminated with \0

  },
      // return a percent-encoded representation of the specified byte range
  // @see http://en.wikipedia.org/wiki/Percent-encoding
  percentEncode$1 = function (bytes, start, end) {
    var i,
        result = '';

    for (i = start; i < end; i++) {
      result += '%' + ('00' + bytes[i].toString(16)).slice(-2);
    }

    return result;
  },
      // return the string representation of the specified byte range,
  // interpreted as UTf-8.
  parseUtf8 = function (bytes, start, end) {
    return decodeURIComponent(percentEncode$1(bytes, start, end));
  },
      // return the string representation of the specified byte range,
  // interpreted as ISO-8859-1.
  parseIso88591$1 = function (bytes, start, end) {
    return unescape(percentEncode$1(bytes, start, end)); // jshint ignore:line
  },
      parseSyncSafeInteger$1 = function (data) {
    return data[0] << 21 | data[1] << 14 | data[2] << 7 | data[3];
  },
      frameParsers = {
    'APIC': function (frame) {
      var i = 1,
          mimeTypeEndIndex,
          descriptionEndIndex,
          LINK_MIME_TYPE = '-->';

      if (frame.data[0] !== textEncodingDescriptionByte.Utf8) {
        // ignore frames with unrecognized character encodings
        return;
      } // parsing fields [ID3v2.4.0 section 4.14.]


      mimeTypeEndIndex = typedArrayIndexOf(frame.data, 0, i);

      if (mimeTypeEndIndex < 0) {
        // malformed frame
        return;
      } // parsing Mime type field (terminated with \0)


      frame.mimeType = parseIso88591$1(frame.data, i, mimeTypeEndIndex);
      i = mimeTypeEndIndex + 1; // parsing 1-byte Picture Type field

      frame.pictureType = frame.data[i];
      i++;
      descriptionEndIndex = typedArrayIndexOf(frame.data, 0, i);

      if (descriptionEndIndex < 0) {
        // malformed frame
        return;
      } // parsing Description field (terminated with \0)


      frame.description = parseUtf8(frame.data, i, descriptionEndIndex);
      i = descriptionEndIndex + 1;

      if (frame.mimeType === LINK_MIME_TYPE) {
        // parsing Picture Data field as URL (always represented as ISO-8859-1 [ID3v2.4.0 section 4.])
        frame.url = parseIso88591$1(frame.data, i, frame.data.length);
      } else {
        // parsing Picture Data field as binary data
        frame.pictureData = frame.data.subarray(i, frame.data.length);
      }
    },
    'T*': function (frame) {
      if (frame.data[0] !== textEncodingDescriptionByte.Utf8) {
        // ignore frames with unrecognized character encodings
        return;
      } // parse text field, do not include null terminator in the frame value
      // frames that allow different types of encoding contain terminated text [ID3v2.4.0 section 4.]


      frame.value = parseUtf8(frame.data, 1, frame.data.length).replace(/\0*$/, ''); // text information frames supports multiple strings, stored as a terminator separated list [ID3v2.4.0 section 4.2.]

      frame.values = frame.value.split('\0');
    },
    'TXXX': function (frame) {
      var descriptionEndIndex;

      if (frame.data[0] !== textEncodingDescriptionByte.Utf8) {
        // ignore frames with unrecognized character encodings
        return;
      }

      descriptionEndIndex = typedArrayIndexOf(frame.data, 0, 1);

      if (descriptionEndIndex === -1) {
        return;
      } // parse the text fields


      frame.description = parseUtf8(frame.data, 1, descriptionEndIndex); // do not include the null terminator in the tag value
      // frames that allow different types of encoding contain terminated text
      // [ID3v2.4.0 section 4.]

      frame.value = parseUtf8(frame.data, descriptionEndIndex + 1, frame.data.length).replace(/\0*$/, '');
      frame.data = frame.value;
    },
    'W*': function (frame) {
      // parse URL field; URL fields are always represented as ISO-8859-1 [ID3v2.4.0 section 4.]
      // if the value is followed by a string termination all the following information should be ignored [ID3v2.4.0 section 4.3]
      frame.url = parseIso88591$1(frame.data, 0, frame.data.length).replace(/\0.*$/, '');
    },
    'WXXX': function (frame) {
      var descriptionEndIndex;

      if (frame.data[0] !== textEncodingDescriptionByte.Utf8) {
        // ignore frames with unrecognized character encodings
        return;
      }

      descriptionEndIndex = typedArrayIndexOf(frame.data, 0, 1);

      if (descriptionEndIndex === -1) {
        return;
      } // parse the description and URL fields


      frame.description = parseUtf8(frame.data, 1, descriptionEndIndex); // URL fields are always represented as ISO-8859-1 [ID3v2.4.0 section 4.]
      // if the value is followed by a string termination all the following information
      // should be ignored [ID3v2.4.0 section 4.3]

      frame.url = parseIso88591$1(frame.data, descriptionEndIndex + 1, frame.data.length).replace(/\0.*$/, '');
    },
    'PRIV': function (frame) {
      var i;

      for (i = 0; i < frame.data.length; i++) {
        if (frame.data[i] === 0) {
          // parse the description and URL fields
          frame.owner = parseIso88591$1(frame.data, 0, i);
          break;
        }
      }

      frame.privateData = frame.data.subarray(i + 1);
      frame.data = frame.privateData;
    }
  };

  var parseId3Frames$1 = function (data) {
    var frameSize,
        frameHeader,
        frameStart = 10,
        tagSize = 0,
        frames = []; // If we don't have enough data for a header, 10 bytes,
    // or 'ID3' in the first 3 bytes this is not a valid ID3 tag.

    if (data.length < 10 || data[0] !== 'I'.charCodeAt(0) || data[1] !== 'D'.charCodeAt(0) || data[2] !== '3'.charCodeAt(0)) {
      return;
    } // the frame size is transmitted as a 28-bit integer in the
    // last four bytes of the ID3 header.
    // The most significant bit of each byte is dropped and the
    // results concatenated to recover the actual value.


    tagSize = parseSyncSafeInteger$1(data.subarray(6, 10)); // ID3 reports the tag size excluding the header but it's more
    // convenient for our comparisons to include it

    tagSize += 10; // check bit 6 of byte 5 for the extended header flag.

    var hasExtendedHeader = data[5] & 0x40;

    if (hasExtendedHeader) {
      // advance the frame start past the extended header
      frameStart += 4; // header size field

      frameStart += parseSyncSafeInteger$1(data.subarray(10, 14));
      tagSize -= parseSyncSafeInteger$1(data.subarray(16, 20)); // clip any padding off the end
    } // parse one or more ID3 frames
    // http://id3.org/id3v2.3.0#ID3v2_frame_overview


    do {
      // determine the number of bytes in this frame
      frameSize = parseSyncSafeInteger$1(data.subarray(frameStart + 4, frameStart + 8));

      if (frameSize < 1) {
        break;
      }

      frameHeader = String.fromCharCode(data[frameStart], data[frameStart + 1], data[frameStart + 2], data[frameStart + 3]);
      var frame = {
        id: frameHeader,
        data: data.subarray(frameStart + 10, frameStart + frameSize + 10)
      };
      frame.key = frame.id; // parse frame values

      if (frameParsers[frame.id]) {
        // use frame specific parser
        frameParsers[frame.id](frame);
      } else if (frame.id[0] === 'T') {
        // use text frame generic parser
        frameParsers['T*'](frame);
      } else if (frame.id[0] === 'W') {
        // use URL link frame generic parser
        frameParsers['W*'](frame);
      }

      frames.push(frame);
      frameStart += 10; // advance past the frame header

      frameStart += frameSize; // advance past the frame body
    } while (frameStart < tagSize);

    return frames;
  };

  var parseId3 = {
    parseId3Frames: parseId3Frames$1,
    parseSyncSafeInteger: parseSyncSafeInteger$1,
    frameParsers: frameParsers
  };
  /**
   * mux.js
   *
   * Copyright (c) Brightcove
   * Licensed Apache-2.0 https://github.com/videojs/mux.js/blob/master/LICENSE
   *
   * Accepts program elementary stream (PES) data events and parses out
   * ID3 metadata from them, if present.
   * @see http://id3.org/id3v2.3.0
   */

  var Stream$5 = stream,
      StreamTypes$3 = streamTypes,
      id3 = parseId3,
      MetadataStream;

  MetadataStream = function (options) {
    var settings = {
      // the bytes of the program-level descriptor field in MP2T
      // see ISO/IEC 13818-1:2013 (E), section 2.6 "Program and
      // program element descriptors"
      descriptor: options && options.descriptor
    },
        // the total size in bytes of the ID3 tag being parsed
    tagSize = 0,
        // tag data that is not complete enough to be parsed
    buffer = [],
        // the total number of bytes currently in the buffer
    bufferSize = 0,
        i;
    MetadataStream.prototype.init.call(this); // calculate the text track in-band metadata track dispatch type
    // https://html.spec.whatwg.org/multipage/embedded-content.html#steps-to-expose-a-media-resource-specific-text-track

    this.dispatchType = StreamTypes$3.METADATA_STREAM_TYPE.toString(16);

    if (settings.descriptor) {
      for (i = 0; i < settings.descriptor.length; i++) {
        this.dispatchType += ('00' + settings.descriptor[i].toString(16)).slice(-2);
      }
    }

    this.push = function (chunk) {
      var tag, frameStart, frameSize, frame, i, frameHeader;

      if (chunk.type !== 'timed-metadata') {
        return;
      } // if data_alignment_indicator is set in the PES header,
      // we must have the start of a new ID3 tag. Assume anything
      // remaining in the buffer was malformed and throw it out


      if (chunk.dataAlignmentIndicator) {
        bufferSize = 0;
        buffer.length = 0;
      } // ignore events that don't look like ID3 data


      if (buffer.length === 0 && (chunk.data.length < 10 || chunk.data[0] !== 'I'.charCodeAt(0) || chunk.data[1] !== 'D'.charCodeAt(0) || chunk.data[2] !== '3'.charCodeAt(0))) {
        this.trigger('log', {
          level: 'warn',
          message: 'Skipping unrecognized metadata packet'
        });
        return;
      } // add this chunk to the data we've collected so far


      buffer.push(chunk);
      bufferSize += chunk.data.byteLength; // grab the size of the entire frame from the ID3 header

      if (buffer.length === 1) {
        // the frame size is transmitted as a 28-bit integer in the
        // last four bytes of the ID3 header.
        // The most significant bit of each byte is dropped and the
        // results concatenated to recover the actual value.
        tagSize = id3.parseSyncSafeInteger(chunk.data.subarray(6, 10)); // ID3 reports the tag size excluding the header but it's more
        // convenient for our comparisons to include it

        tagSize += 10;
      } // if the entire frame has not arrived, wait for more data


      if (bufferSize < tagSize) {
        return;
      } // collect the entire frame so it can be parsed


      tag = {
        data: new Uint8Array(tagSize),
        frames: [],
        pts: buffer[0].pts,
        dts: buffer[0].dts
      };

      for (i = 0; i < tagSize;) {
        tag.data.set(buffer[0].data.subarray(0, tagSize - i), i);
        i += buffer[0].data.byteLength;
        bufferSize -= buffer[0].data.byteLength;
        buffer.shift();
      } // find the start of the first frame and the end of the tag


      frameStart = 10;

      if (tag.data[5] & 0x40) {
        // advance the frame start past the extended header
        frameStart += 4; // header size field

        frameStart += id3.parseSyncSafeInteger(tag.data.subarray(10, 14)); // clip any padding off the end

        tagSize -= id3.parseSyncSafeInteger(tag.data.subarray(16, 20));
      } // parse one or more ID3 frames
      // http://id3.org/id3v2.3.0#ID3v2_frame_overview


      do {
        // determine the number of bytes in this frame
        frameSize = id3.parseSyncSafeInteger(tag.data.subarray(frameStart + 4, frameStart + 8));

        if (frameSize < 1) {
          this.trigger('log', {
            level: 'warn',
            message: 'Malformed ID3 frame encountered. Skipping remaining metadata parsing.'
          }); // If the frame is malformed, don't parse any further frames but allow previous valid parsed frames
          // to be sent along.

          break;
        }

        frameHeader = String.fromCharCode(tag.data[frameStart], tag.data[frameStart + 1], tag.data[frameStart + 2], tag.data[frameStart + 3]);
        frame = {
          id: frameHeader,
          data: tag.data.subarray(frameStart + 10, frameStart + frameSize + 10)
        };
        frame.key = frame.id; // parse frame values

        if (id3.frameParsers[frame.id]) {
          // use frame specific parser
          id3.frameParsers[frame.id](frame);
        } else if (frame.id[0] === 'T') {
          // use text frame generic parser
          id3.frameParsers['T*'](frame);
        } else if (frame.id[0] === 'W') {
          // use URL link frame generic parser
          id3.frameParsers['W*'](frame);
        } // handle the special PRIV frame used to indicate the start
        // time for raw AAC data


        if (frame.owner === 'com.apple.streaming.transportStreamTimestamp') {
          var d = frame.data,
              size = (d[3] & 0x01) << 30 | d[4] << 22 | d[5] << 14 | d[6] << 6 | d[7] >>> 2;
          size *= 4;
          size += d[7] & 0x03;
          frame.timeStamp = size; // in raw AAC, all subsequent data will be timestamped based
          // on the value of this frame
          // we couldn't have known the appropriate pts and dts before
          // parsing this ID3 tag so set those values now

          if (tag.pts === undefined && tag.dts === undefined) {
            tag.pts = frame.timeStamp;
            tag.dts = frame.timeStamp;
          }

          this.trigger('timestamp', frame);
        }

        tag.frames.push(frame);
        frameStart += 10; // advance past the frame header

        frameStart += frameSize; // advance past the frame body
      } while (frameStart < tagSize);

      this.trigger('data', tag);
    };
  };

  MetadataStream.prototype = new Stream$5();
  var metadataStream = MetadataStream;
  /**
   * mux.js
   *
   * Copyright (c) Brightcove
   * Licensed Apache-2.0 https://github.com/videojs/mux.js/blob/master/LICENSE
   *
   * A stream-based mp2t to mp4 converter. This utility can be used to
   * deliver mp4s to a SourceBuffer on platforms that support native
   * Media Source Extensions.
   */

  var Stream$4 = stream,
      CaptionStream$1 = captionStream,
      StreamTypes$2 = streamTypes,
      TimestampRolloverStream = timestampRolloverStream.TimestampRolloverStream; // object types

  var TransportPacketStream, TransportParseStream, ElementaryStream; // constants

  var MP2T_PACKET_LENGTH$1 = 188,
      // bytes
  SYNC_BYTE$1 = 0x47;
  /**
   * Splits an incoming stream of binary data into MPEG-2 Transport
   * Stream packets.
   */

  TransportPacketStream = function () {
    var buffer = new Uint8Array(MP2T_PACKET_LENGTH$1),
        bytesInBuffer = 0;
    TransportPacketStream.prototype.init.call(this); // Deliver new bytes to the stream.

    /**
     * Split a stream of data into M2TS packets
    **/

    this.push = function (bytes) {
      var startIndex = 0,
          endIndex = MP2T_PACKET_LENGTH$1,
          everything; // If there are bytes remaining from the last segment, prepend them to the
      // bytes that were pushed in

      if (bytesInBuffer) {
        everything = new Uint8Array(bytes.byteLength + bytesInBuffer);
        everything.set(buffer.subarray(0, bytesInBuffer));
        everything.set(bytes, bytesInBuffer);
        bytesInBuffer = 0;
      } else {
        everything = bytes;
      } // While we have enough data for a packet


      while (endIndex < everything.byteLength) {
        // Look for a pair of start and end sync bytes in the data..
        if (everything[startIndex] === SYNC_BYTE$1 && everything[endIndex] === SYNC_BYTE$1) {
          // We found a packet so emit it and jump one whole packet forward in
          // the stream
          this.trigger('data', everything.subarray(startIndex, endIndex));
          startIndex += MP2T_PACKET_LENGTH$1;
          endIndex += MP2T_PACKET_LENGTH$1;
          continue;
        } // If we get here, we have somehow become de-synchronized and we need to step
        // forward one byte at a time until we find a pair of sync bytes that denote
        // a packet


        startIndex++;
        endIndex++;
      } // If there was some data left over at the end of the segment that couldn't
      // possibly be a whole packet, keep it because it might be the start of a packet
      // that continues in the next segment


      if (startIndex < everything.byteLength) {
        buffer.set(everything.subarray(startIndex), 0);
        bytesInBuffer = everything.byteLength - startIndex;
      }
    };
    /**
     * Passes identified M2TS packets to the TransportParseStream to be parsed
    **/


    this.flush = function () {
      // If the buffer contains a whole packet when we are being flushed, emit it
      // and empty the buffer. Otherwise hold onto the data because it may be
      // important for decoding the next segment
      if (bytesInBuffer === MP2T_PACKET_LENGTH$1 && buffer[0] === SYNC_BYTE$1) {
        this.trigger('data', buffer);
        bytesInBuffer = 0;
      }

      this.trigger('done');
    };

    this.endTimeline = function () {
      this.flush();
      this.trigger('endedtimeline');
    };

    this.reset = function () {
      bytesInBuffer = 0;
      this.trigger('reset');
    };
  };

  TransportPacketStream.prototype = new Stream$4();
  /**
   * Accepts an MP2T TransportPacketStream and emits data events with parsed
   * forms of the individual transport stream packets.
   */

  TransportParseStream = function () {
    var parsePsi, parsePat, parsePmt, self;
    TransportParseStream.prototype.init.call(this);
    self = this;
    this.packetsWaitingForPmt = [];
    this.programMapTable = undefined;

    parsePsi = function (payload, psi) {
      var offset = 0; // PSI packets may be split into multiple sections and those
      // sections may be split into multiple packets. If a PSI
      // section starts in this packet, the payload_unit_start_indicator
      // will be true and the first byte of the payload will indicate
      // the offset from the current position to the start of the
      // section.

      if (psi.payloadUnitStartIndicator) {
        offset += payload[offset] + 1;
      }

      if (psi.type === 'pat') {
        parsePat(payload.subarray(offset), psi);
      } else {
        parsePmt(payload.subarray(offset), psi);
      }
    };

    parsePat = function (payload, pat) {
      pat.section_number = payload[7]; // eslint-disable-line camelcase

      pat.last_section_number = payload[8]; // eslint-disable-line camelcase
      // skip the PSI header and parse the first PMT entry

      self.pmtPid = (payload[10] & 0x1F) << 8 | payload[11];
      pat.pmtPid = self.pmtPid;
    };
    /**
     * Parse out the relevant fields of a Program Map Table (PMT).
     * @param payload {Uint8Array} the PMT-specific portion of an MP2T
     * packet. The first byte in this array should be the table_id
     * field.
     * @param pmt {object} the object that should be decorated with
     * fields parsed from the PMT.
     */


    parsePmt = function (payload, pmt) {
      var sectionLength, tableEnd, programInfoLength, offset; // PMTs can be sent ahead of the time when they should actually
      // take effect. We don't believe this should ever be the case
      // for HLS but we'll ignore "forward" PMT declarations if we see
      // them. Future PMT declarations have the current_next_indicator
      // set to zero.

      if (!(payload[5] & 0x01)) {
        return;
      } // overwrite any existing program map table


      self.programMapTable = {
        video: null,
        audio: null,
        'timed-metadata': {}
      }; // the mapping table ends at the end of the current section

      sectionLength = (payload[1] & 0x0f) << 8 | payload[2];
      tableEnd = 3 + sectionLength - 4; // to determine where the table is, we have to figure out how
      // long the program info descriptors are

      programInfoLength = (payload[10] & 0x0f) << 8 | payload[11]; // advance the offset to the first entry in the mapping table

      offset = 12 + programInfoLength;

      while (offset < tableEnd) {
        var streamType = payload[offset];
        var pid = (payload[offset + 1] & 0x1F) << 8 | payload[offset + 2]; // only map a single elementary_pid for audio and video stream types
        // TODO: should this be done for metadata too? for now maintain behavior of
        //       multiple metadata streams

        if (streamType === StreamTypes$2.H264_STREAM_TYPE && self.programMapTable.video === null) {
          self.programMapTable.video = pid;
        } else if (streamType === StreamTypes$2.ADTS_STREAM_TYPE && self.programMapTable.audio === null) {
          self.programMapTable.audio = pid;
        } else if (streamType === StreamTypes$2.METADATA_STREAM_TYPE) {
          // map pid to stream type for metadata streams
          self.programMapTable['timed-metadata'][pid] = streamType;
        } // move to the next table entry
        // skip past the elementary stream descriptors, if present


        offset += ((payload[offset + 3] & 0x0F) << 8 | payload[offset + 4]) + 5;
      } // record the map on the packet as well


      pmt.programMapTable = self.programMapTable;
    };
    /**
     * Deliver a new MP2T packet to the next stream in the pipeline.
     */


    this.push = function (packet) {
      var result = {},
          offset = 4;
      result.payloadUnitStartIndicator = !!(packet[1] & 0x40); // pid is a 13-bit field starting at the last bit of packet[1]

      result.pid = packet[1] & 0x1f;
      result.pid <<= 8;
      result.pid |= packet[2]; // if an adaption field is present, its length is specified by the
      // fifth byte of the TS packet header. The adaptation field is
      // used to add stuffing to PES packets that don't fill a complete
      // TS packet, and to specify some forms of timing and control data
      // that we do not currently use.

      if ((packet[3] & 0x30) >>> 4 > 0x01) {
        offset += packet[offset] + 1;
      } // parse the rest of the packet based on the type


      if (result.pid === 0) {
        result.type = 'pat';
        parsePsi(packet.subarray(offset), result);
        this.trigger('data', result);
      } else if (result.pid === this.pmtPid) {
        result.type = 'pmt';
        parsePsi(packet.subarray(offset), result);
        this.trigger('data', result); // if there are any packets waiting for a PMT to be found, process them now

        while (this.packetsWaitingForPmt.length) {
          this.processPes_.apply(this, this.packetsWaitingForPmt.shift());
        }
      } else if (this.programMapTable === undefined) {
        // When we have not seen a PMT yet, defer further processing of
        // PES packets until one has been parsed
        this.packetsWaitingForPmt.push([packet, offset, result]);
      } else {
        this.processPes_(packet, offset, result);
      }
    };

    this.processPes_ = function (packet, offset, result) {
      // set the appropriate stream type
      if (result.pid === this.programMapTable.video) {
        result.streamType = StreamTypes$2.H264_STREAM_TYPE;
      } else if (result.pid === this.programMapTable.audio) {
        result.streamType = StreamTypes$2.ADTS_STREAM_TYPE;
      } else {
        // if not video or audio, it is timed-metadata or unknown
        // if unknown, streamType will be undefined
        result.streamType = this.programMapTable['timed-metadata'][result.pid];
      }

      result.type = 'pes';
      result.data = packet.subarray(offset);
      this.trigger('data', result);
    };
  };

  TransportParseStream.prototype = new Stream$4();
  TransportParseStream.STREAM_TYPES = {
    h264: 0x1b,
    adts: 0x0f
  };
  /**
   * Reconsistutes program elementary stream (PES) packets from parsed
   * transport stream packets. That is, if you pipe an
   * mp2t.TransportParseStream into a mp2t.ElementaryStream, the output
   * events will be events which capture the bytes for individual PES
   * packets plus relevant metadata that has been extracted from the
   * container.
   */

  ElementaryStream = function () {
    var self = this,
        segmentHadPmt = false,
        // PES packet fragments
    video = {
      data: [],
      size: 0
    },
        audio = {
      data: [],
      size: 0
    },
        timedMetadata = {
      data: [],
      size: 0
    },
        programMapTable,
        parsePes = function (payload, pes) {
      var ptsDtsFlags;
      const startPrefix = payload[0] << 16 | payload[1] << 8 | payload[2]; // default to an empty array

      pes.data = new Uint8Array(); // In certain live streams, the start of a TS fragment has ts packets
      // that are frame data that is continuing from the previous fragment. This
      // is to check that the pes data is the start of a new pes payload

      if (startPrefix !== 1) {
        return;
      } // get the packet length, this will be 0 for video


      pes.packetLength = 6 + (payload[4] << 8 | payload[5]); // find out if this packets starts a new keyframe

      pes.dataAlignmentIndicator = (payload[6] & 0x04) !== 0; // PES packets may be annotated with a PTS value, or a PTS value
      // and a DTS value. Determine what combination of values is
      // available to work with.

      ptsDtsFlags = payload[7]; // PTS and DTS are normally stored as a 33-bit number.  Javascript
      // performs all bitwise operations on 32-bit integers but javascript
      // supports a much greater range (52-bits) of integer using standard
      // mathematical operations.
      // We construct a 31-bit value using bitwise operators over the 31
      // most significant bits and then multiply by 4 (equal to a left-shift
      // of 2) before we add the final 2 least significant bits of the
      // timestamp (equal to an OR.)

      if (ptsDtsFlags & 0xC0) {
        // the PTS and DTS are not written out directly. For information
        // on how they are encoded, see
        // http://dvd.sourceforge.net/dvdinfo/pes-hdr.html
        pes.pts = (payload[9] & 0x0E) << 27 | (payload[10] & 0xFF) << 20 | (payload[11] & 0xFE) << 12 | (payload[12] & 0xFF) << 5 | (payload[13] & 0xFE) >>> 3;
        pes.pts *= 4; // Left shift by 2

        pes.pts += (payload[13] & 0x06) >>> 1; // OR by the two LSBs

        pes.dts = pes.pts;

        if (ptsDtsFlags & 0x40) {
          pes.dts = (payload[14] & 0x0E) << 27 | (payload[15] & 0xFF) << 20 | (payload[16] & 0xFE) << 12 | (payload[17] & 0xFF) << 5 | (payload[18] & 0xFE) >>> 3;
          pes.dts *= 4; // Left shift by 2

          pes.dts += (payload[18] & 0x06) >>> 1; // OR by the two LSBs
        }
      } // the data section starts immediately after the PES header.
      // pes_header_data_length specifies the number of header bytes
      // that follow the last byte of the field.


      pes.data = payload.subarray(9 + payload[8]);
    },

    /**
      * Pass completely parsed PES packets to the next stream in the pipeline
     **/
    flushStream = function (stream, type, forceFlush) {
      var packetData = new Uint8Array(stream.size),
          event = {
        type: type
      },
          i = 0,
          offset = 0,
          packetFlushable = false,
          fragment; // do nothing if there is not enough buffered data for a complete
      // PES header

      if (!stream.data.length || stream.size < 9) {
        return;
      }

      event.trackId = stream.data[0].pid; // reassemble the packet

      for (i = 0; i < stream.data.length; i++) {
        fragment = stream.data[i];
        packetData.set(fragment.data, offset);
        offset += fragment.data.byteLength;
      } // parse assembled packet's PES header


      parsePes(packetData, event); // non-video PES packets MUST have a non-zero PES_packet_length
      // check that there is enough stream data to fill the packet

      packetFlushable = type === 'video' || event.packetLength <= stream.size; // flush pending packets if the conditions are right

      if (forceFlush || packetFlushable) {
        stream.size = 0;
        stream.data.length = 0;
      } // only emit packets that are complete. this is to avoid assembling
      // incomplete PES packets due to poor segmentation


      if (packetFlushable) {
        self.trigger('data', event);
      }
    };

    ElementaryStream.prototype.init.call(this);
    /**
     * Identifies M2TS packet types and parses PES packets using metadata
     * parsed from the PMT
     **/

    this.push = function (data) {
      ({
        pat: function () {// we have to wait for the PMT to arrive as well before we
          // have any meaningful metadata
        },
        pes: function () {
          var stream, streamType;

          switch (data.streamType) {
            case StreamTypes$2.H264_STREAM_TYPE:
              stream = video;
              streamType = 'video';
              break;

            case StreamTypes$2.ADTS_STREAM_TYPE:
              stream = audio;
              streamType = 'audio';
              break;

            case StreamTypes$2.METADATA_STREAM_TYPE:
              stream = timedMetadata;
              streamType = 'timed-metadata';
              break;

            default:
              // ignore unknown stream types
              return;
          } // if a new packet is starting, we can flush the completed
          // packet


          if (data.payloadUnitStartIndicator) {
            flushStream(stream, streamType, true);
          } // buffer this fragment until we are sure we've received the
          // complete payload


          stream.data.push(data);
          stream.size += data.data.byteLength;
        },
        pmt: function () {
          var event = {
            type: 'metadata',
            tracks: []
          };
          programMapTable = data.programMapTable; // translate audio and video streams to tracks

          if (programMapTable.video !== null) {
            event.tracks.push({
              timelineStartInfo: {
                baseMediaDecodeTime: 0
              },
              id: +programMapTable.video,
              codec: 'avc',
              type: 'video'
            });
          }

          if (programMapTable.audio !== null) {
            event.tracks.push({
              timelineStartInfo: {
                baseMediaDecodeTime: 0
              },
              id: +programMapTable.audio,
              codec: 'adts',
              type: 'audio'
            });
          }

          segmentHadPmt = true;
          self.trigger('data', event);
        }
      })[data.type]();
    };

    this.reset = function () {
      video.size = 0;
      video.data.length = 0;
      audio.size = 0;
      audio.data.length = 0;
      this.trigger('reset');
    };
    /**
     * Flush any remaining input. Video PES packets may be of variable
     * length. Normally, the start of a new video packet can trigger the
     * finalization of the previous packet. That is not possible if no
     * more video is forthcoming, however. In that case, some other
     * mechanism (like the end of the file) has to be employed. When it is
     * clear that no additional data is forthcoming, calling this method
     * will flush the buffered packets.
     */


    this.flushStreams_ = function () {
      // !!THIS ORDER IS IMPORTANT!!
      // video first then audio
      flushStream(video, 'video');
      flushStream(audio, 'audio');
      flushStream(timedMetadata, 'timed-metadata');
    };

    this.flush = function () {
      // if on flush we haven't had a pmt emitted
      // and we have a pmt to emit. emit the pmt
      // so that we trigger a trackinfo downstream.
      if (!segmentHadPmt && programMapTable) {
        var pmt = {
          type: 'metadata',
          tracks: []
        }; // translate audio and video streams to tracks

        if (programMapTable.video !== null) {
          pmt.tracks.push({
            timelineStartInfo: {
              baseMediaDecodeTime: 0
            },
            id: +programMapTable.video,
            codec: 'avc',
            type: 'video'
          });
        }

        if (programMapTable.audio !== null) {
          pmt.tracks.push({
            timelineStartInfo: {
              baseMediaDecodeTime: 0
            },
            id: +programMapTable.audio,
            codec: 'adts',
            type: 'audio'
          });
        }

        self.trigger('data', pmt);
      }

      segmentHadPmt = false;
      this.flushStreams_();
      this.trigger('done');
    };
  };

  ElementaryStream.prototype = new Stream$4();
  var m2ts$1 = {
    PAT_PID: 0x0000,
    MP2T_PACKET_LENGTH: MP2T_PACKET_LENGTH$1,
    TransportPacketStream: TransportPacketStream,
    TransportParseStream: TransportParseStream,
    ElementaryStream: ElementaryStream,
    TimestampRolloverStream: TimestampRolloverStream,
    CaptionStream: CaptionStream$1.CaptionStream,
    Cea608Stream: CaptionStream$1.Cea608Stream,
    Cea708Stream: CaptionStream$1.Cea708Stream,
    MetadataStream: metadataStream
  };

  for (var type in StreamTypes$2) {
    if (StreamTypes$2.hasOwnProperty(type)) {
      m2ts$1[type] = StreamTypes$2[type];
    }
  }

  var m2ts_1 = m2ts$1;
  /**
   * mux.js
   *
   * Copyright (c) Brightcove
   * Licensed Apache-2.0 https://github.com/videojs/mux.js/blob/master/LICENSE
   */

  var Stream$3 = stream;
  var ONE_SECOND_IN_TS$2 = clock$2.ONE_SECOND_IN_TS;
  var AdtsStream$1;
  var ADTS_SAMPLING_FREQUENCIES$1 = [96000, 88200, 64000, 48000, 44100, 32000, 24000, 22050, 16000, 12000, 11025, 8000, 7350];
  /*
   * Accepts a ElementaryStream and emits data events with parsed
   * AAC Audio Frames of the individual packets. Input audio in ADTS
   * format is unpacked and re-emitted as AAC frames.
   *
   * @see http://wiki.multimedia.cx/index.php?title=ADTS
   * @see http://wiki.multimedia.cx/?title=Understanding_AAC
   */

  AdtsStream$1 = function (handlePartialSegments) {
    var buffer,
        frameNum = 0;
    AdtsStream$1.prototype.init.call(this);

    this.skipWarn_ = function (start, end) {
      this.trigger('log', {
        level: 'warn',
        message: `adts skiping bytes ${start} to ${end} in frame ${frameNum} outside syncword`
      });
    };

    this.push = function (packet) {
      var i = 0,
          frameLength,
          protectionSkipBytes,
          oldBuffer,
          sampleCount,
          adtsFrameDuration;

      if (!handlePartialSegments) {
        frameNum = 0;
      }

      if (packet.type !== 'audio') {
        // ignore non-audio data
        return;
      } // Prepend any data in the buffer to the input data so that we can parse
      // aac frames the cross a PES packet boundary


      if (buffer && buffer.length) {
        oldBuffer = buffer;
        buffer = new Uint8Array(oldBuffer.byteLength + packet.data.byteLength);
        buffer.set(oldBuffer);
        buffer.set(packet.data, oldBuffer.byteLength);
      } else {
        buffer = packet.data;
      } // unpack any ADTS frames which have been fully received
      // for details on the ADTS header, see http://wiki.multimedia.cx/index.php?title=ADTS


      var skip; // We use i + 7 here because we want to be able to parse the entire header.
      // If we don't have enough bytes to do that, then we definitely won't have a full frame.

      while (i + 7 < buffer.length) {
        // Look for the start of an ADTS header..
        if (buffer[i] !== 0xFF || (buffer[i + 1] & 0xF6) !== 0xF0) {
          if (typeof skip !== 'number') {
            skip = i;
          } // If a valid header was not found,  jump one forward and attempt to
          // find a valid ADTS header starting at the next byte


          i++;
          continue;
        }

        if (typeof skip === 'number') {
          this.skipWarn_(skip, i);
          skip = null;
        } // The protection skip bit tells us if we have 2 bytes of CRC data at the
        // end of the ADTS header


        protectionSkipBytes = (~buffer[i + 1] & 0x01) * 2; // Frame length is a 13 bit integer starting 16 bits from the
        // end of the sync sequence
        // NOTE: frame length includes the size of the header

        frameLength = (buffer[i + 3] & 0x03) << 11 | buffer[i + 4] << 3 | (buffer[i + 5] & 0xe0) >> 5;
        sampleCount = ((buffer[i + 6] & 0x03) + 1) * 1024;
        adtsFrameDuration = sampleCount * ONE_SECOND_IN_TS$2 / ADTS_SAMPLING_FREQUENCIES$1[(buffer[i + 2] & 0x3c) >>> 2]; // If we don't have enough data to actually finish this ADTS frame,
        // then we have to wait for more data

        if (buffer.byteLength - i < frameLength) {
          break;
        } // Otherwise, deliver the complete AAC frame


        this.trigger('data', {
          pts: packet.pts + frameNum * adtsFrameDuration,
          dts: packet.dts + frameNum * adtsFrameDuration,
          sampleCount: sampleCount,
          audioobjecttype: (buffer[i + 2] >>> 6 & 0x03) + 1,
          channelcount: (buffer[i + 2] & 1) << 2 | (buffer[i + 3] & 0xc0) >>> 6,
          samplerate: ADTS_SAMPLING_FREQUENCIES$1[(buffer[i + 2] & 0x3c) >>> 2],
          samplingfrequencyindex: (buffer[i + 2] & 0x3c) >>> 2,
          // assume ISO/IEC 14496-12 AudioSampleEntry default of 16
          samplesize: 16,
          // data is the frame without it's header
          data: buffer.subarray(i + 7 + protectionSkipBytes, i + frameLength)
        });
        frameNum++;
        i += frameLength;
      }

      if (typeof skip === 'number') {
        this.skipWarn_(skip, i);
        skip = null;
      } // remove processed bytes from the buffer.


      buffer = buffer.subarray(i);
    };

    this.flush = function () {
      frameNum = 0;
      this.trigger('done');
    };

    this.reset = function () {
      buffer = void 0;
      this.trigger('reset');
    };

    this.endTimeline = function () {
      buffer = void 0;
      this.trigger('endedtimeline');
    };
  };

  AdtsStream$1.prototype = new Stream$3();
  var adts = AdtsStream$1;
  /**
   * mux.js
   *
   * Copyright (c) Brightcove
   * Licensed Apache-2.0 https://github.com/videojs/mux.js/blob/master/LICENSE
   */

  var ExpGolomb$1;
  /**
   * Parser for exponential Golomb codes, a variable-bitwidth number encoding
   * scheme used by h264.
   */

  ExpGolomb$1 = function (workingData) {
    var // the number of bytes left to examine in workingData
    workingBytesAvailable = workingData.byteLength,
        // the current word being examined
    workingWord = 0,
        // :uint
    // the number of bits left to examine in the current word
    workingBitsAvailable = 0; // :uint;
    // ():uint

    this.length = function () {
      return 8 * workingBytesAvailable;
    }; // ():uint


    this.bitsAvailable = function () {
      return 8 * workingBytesAvailable + workingBitsAvailable;
    }; // ():void


    this.loadWord = function () {
      var position = workingData.byteLength - workingBytesAvailable,
          workingBytes = new Uint8Array(4),
          availableBytes = Math.min(4, workingBytesAvailable);

      if (availableBytes === 0) {
        throw new Error('no bytes available');
      }

      workingBytes.set(workingData.subarray(position, position + availableBytes));
      workingWord = new DataView(workingBytes.buffer).getUint32(0); // track the amount of workingData that has been processed

      workingBitsAvailable = availableBytes * 8;
      workingBytesAvailable -= availableBytes;
    }; // (count:int):void


    this.skipBits = function (count) {
      var skipBytes; // :int

      if (workingBitsAvailable > count) {
        workingWord <<= count;
        workingBitsAvailable -= count;
      } else {
        count -= workingBitsAvailable;
        skipBytes = Math.floor(count / 8);
        count -= skipBytes * 8;
        workingBytesAvailable -= skipBytes;
        this.loadWord();
        workingWord <<= count;
        workingBitsAvailable -= count;
      }
    }; // (size:int):uint


    this.readBits = function (size) {
      var bits = Math.min(workingBitsAvailable, size),
          // :uint
      valu = workingWord >>> 32 - bits; // :uint
      // if size > 31, handle error

      workingBitsAvailable -= bits;

      if (workingBitsAvailable > 0) {
        workingWord <<= bits;
      } else if (workingBytesAvailable > 0) {
        this.loadWord();
      }

      bits = size - bits;

      if (bits > 0) {
        return valu << bits | this.readBits(bits);
      }

      return valu;
    }; // ():uint


    this.skipLeadingZeros = function () {
      var leadingZeroCount; // :uint

      for (leadingZeroCount = 0; leadingZeroCount < workingBitsAvailable; ++leadingZeroCount) {
        if ((workingWord & 0x80000000 >>> leadingZeroCount) !== 0) {
          // the first bit of working word is 1
          workingWord <<= leadingZeroCount;
          workingBitsAvailable -= leadingZeroCount;
          return leadingZeroCount;
        }
      } // we exhausted workingWord and still have not found a 1


      this.loadWord();
      return leadingZeroCount + this.skipLeadingZeros();
    }; // ():void


    this.skipUnsignedExpGolomb = function () {
      this.skipBits(1 + this.skipLeadingZeros());
    }; // ():void


    this.skipExpGolomb = function () {
      this.skipBits(1 + this.skipLeadingZeros());
    }; // ():uint


    this.readUnsignedExpGolomb = function () {
      var clz = this.skipLeadingZeros(); // :uint

      return this.readBits(clz + 1) - 1;
    }; // ():int


    this.readExpGolomb = function () {
      var valu = this.readUnsignedExpGolomb(); // :int

      if (0x01 & valu) {
        // the number is odd if the low order bit is set
        return 1 + valu >>> 1; // add 1 to make it even, and divide by 2
      }

      return -1 * (valu >>> 1); // divide by two then make it negative
    }; // Some convenience functions
    // :Boolean


    this.readBoolean = function () {
      return this.readBits(1) === 1;
    }; // ():int


    this.readUnsignedByte = function () {
      return this.readBits(8);
    };

    this.loadWord();
  };

  var expGolomb = ExpGolomb$1;
  /**
   * mux.js
   *
   * Copyright (c) Brightcove
   * Licensed Apache-2.0 https://github.com/videojs/mux.js/blob/master/LICENSE
   */

  var Stream$2 = stream;
  var ExpGolomb = expGolomb;
  var H264Stream$1, NalByteStream;
  var PROFILES_WITH_OPTIONAL_SPS_DATA;
  /**
   * Accepts a NAL unit byte stream and unpacks the embedded NAL units.
   */

  NalByteStream = function () {
    var syncPoint = 0,
        i,
        buffer;
    NalByteStream.prototype.init.call(this);
    /*
     * Scans a byte stream and triggers a data event with the NAL units found.
     * @param {Object} data Event received from H264Stream
     * @param {Uint8Array} data.data The h264 byte stream to be scanned
     *
     * @see H264Stream.push
     */

    this.push = function (data) {
      var swapBuffer;

      if (!buffer) {
        buffer = data.data;
      } else {
        swapBuffer = new Uint8Array(buffer.byteLength + data.data.byteLength);
        swapBuffer.set(buffer);
        swapBuffer.set(data.data, buffer.byteLength);
        buffer = swapBuffer;
      }

      var len = buffer.byteLength; // Rec. ITU-T H.264, Annex B
      // scan for NAL unit boundaries
      // a match looks like this:
      // 0 0 1 .. NAL .. 0 0 1
      // ^ sync point        ^ i
      // or this:
      // 0 0 1 .. NAL .. 0 0 0
      // ^ sync point        ^ i
      // advance the sync point to a NAL start, if necessary

      for (; syncPoint < len - 3; syncPoint++) {
        if (buffer[syncPoint + 2] === 1) {
          // the sync point is properly aligned
          i = syncPoint + 5;
          break;
        }
      }

      while (i < len) {
        // look at the current byte to determine if we've hit the end of
        // a NAL unit boundary
        switch (buffer[i]) {
          case 0:
            // skip past non-sync sequences
            if (buffer[i - 1] !== 0) {
              i += 2;
              break;
            } else if (buffer[i - 2] !== 0) {
              i++;
              break;
            } // deliver the NAL unit if it isn't empty


            if (syncPoint + 3 !== i - 2) {
              this.trigger('data', buffer.subarray(syncPoint + 3, i - 2));
            } // drop trailing zeroes


            do {
              i++;
            } while (buffer[i] !== 1 && i < len);

            syncPoint = i - 2;
            i += 3;
            break;

          case 1:
            // skip past non-sync sequences
            if (buffer[i - 1] !== 0 || buffer[i - 2] !== 0) {
              i += 3;
              break;
            } // deliver the NAL unit


            this.trigger('data', buffer.subarray(syncPoint + 3, i - 2));
            syncPoint = i - 2;
            i += 3;
            break;

          default:
            // the current byte isn't a one or zero, so it cannot be part
            // of a sync sequence
            i += 3;
            break;
        }
      } // filter out the NAL units that were delivered


      buffer = buffer.subarray(syncPoint);
      i -= syncPoint;
      syncPoint = 0;
    };

    this.reset = function () {
      buffer = null;
      syncPoint = 0;
      this.trigger('reset');
    };

    this.flush = function () {
      // deliver the last buffered NAL unit
      if (buffer && buffer.byteLength > 3) {
        this.trigger('data', buffer.subarray(syncPoint + 3));
      } // reset the stream state


      buffer = null;
      syncPoint = 0;
      this.trigger('done');
    };

    this.endTimeline = function () {
      this.flush();
      this.trigger('endedtimeline');
    };
  };

  NalByteStream.prototype = new Stream$2(); // values of profile_idc that indicate additional fields are included in the SPS
  // see Recommendation ITU-T H.264 (4/2013),
  // 7.3.2.1.1 Sequence parameter set data syntax

  PROFILES_WITH_OPTIONAL_SPS_DATA = {
    100: true,
    110: true,
    122: true,
    244: true,
    44: true,
    83: true,
    86: true,
    118: true,
    128: true,
    // TODO: the three profiles below don't
    // appear to have sps data in the specificiation anymore?
    138: true,
    139: true,
    134: true
  };
  /**
   * Accepts input from a ElementaryStream and produces H.264 NAL unit data
   * events.
   */

  H264Stream$1 = function () {
    var nalByteStream = new NalByteStream(),
        self,
        trackId,
        currentPts,
        currentDts,
        discardEmulationPreventionBytes,
        readSequenceParameterSet,
        skipScalingList;
    H264Stream$1.prototype.init.call(this);
    self = this;
    /*
     * Pushes a packet from a stream onto the NalByteStream
     *
     * @param {Object} packet - A packet received from a stream
     * @param {Uint8Array} packet.data - The raw bytes of the packet
     * @param {Number} packet.dts - Decode timestamp of the packet
     * @param {Number} packet.pts - Presentation timestamp of the packet
     * @param {Number} packet.trackId - The id of the h264 track this packet came from
     * @param {('video'|'audio')} packet.type - The type of packet
     *
     */

    this.push = function (packet) {
      if (packet.type !== 'video') {
        return;
      }

      trackId = packet.trackId;
      currentPts = packet.pts;
      currentDts = packet.dts;
      nalByteStream.push(packet);
    };
    /*
     * Identify NAL unit types and pass on the NALU, trackId, presentation and decode timestamps
     * for the NALUs to the next stream component.
     * Also, preprocess caption and sequence parameter NALUs.
     *
     * @param {Uint8Array} data - A NAL unit identified by `NalByteStream.push`
     * @see NalByteStream.push
     */


    nalByteStream.on('data', function (data) {
      var event = {
        trackId: trackId,
        pts: currentPts,
        dts: currentDts,
        data: data,
        nalUnitTypeCode: data[0] & 0x1f
      };

      switch (event.nalUnitTypeCode) {
        case 0x05:
          event.nalUnitType = 'slice_layer_without_partitioning_rbsp_idr';
          break;

        case 0x06:
          event.nalUnitType = 'sei_rbsp';
          event.escapedRBSP = discardEmulationPreventionBytes(data.subarray(1));
          break;

        case 0x07:
          event.nalUnitType = 'seq_parameter_set_rbsp';
          event.escapedRBSP = discardEmulationPreventionBytes(data.subarray(1));
          event.config = readSequenceParameterSet(event.escapedRBSP);
          break;

        case 0x08:
          event.nalUnitType = 'pic_parameter_set_rbsp';
          break;

        case 0x09:
          event.nalUnitType = 'access_unit_delimiter_rbsp';
          break;
      } // This triggers data on the H264Stream


      self.trigger('data', event);
    });
    nalByteStream.on('done', function () {
      self.trigger('done');
    });
    nalByteStream.on('partialdone', function () {
      self.trigger('partialdone');
    });
    nalByteStream.on('reset', function () {
      self.trigger('reset');
    });
    nalByteStream.on('endedtimeline', function () {
      self.trigger('endedtimeline');
    });

    this.flush = function () {
      nalByteStream.flush();
    };

    this.partialFlush = function () {
      nalByteStream.partialFlush();
    };

    this.reset = function () {
      nalByteStream.reset();
    };

    this.endTimeline = function () {
      nalByteStream.endTimeline();
    };
    /**
     * Advance the ExpGolomb decoder past a scaling list. The scaling
     * list is optionally transmitted as part of a sequence parameter
     * set and is not relevant to transmuxing.
     * @param count {number} the number of entries in this scaling list
     * @param expGolombDecoder {object} an ExpGolomb pointed to the
     * start of a scaling list
     * @see Recommendation ITU-T H.264, Section 7.3.2.1.1.1
     */


    skipScalingList = function (count, expGolombDecoder) {
      var lastScale = 8,
          nextScale = 8,
          j,
          deltaScale;

      for (j = 0; j < count; j++) {
        if (nextScale !== 0) {
          deltaScale = expGolombDecoder.readExpGolomb();
          nextScale = (lastScale + deltaScale + 256) % 256;
        }

        lastScale = nextScale === 0 ? lastScale : nextScale;
      }
    };
    /**
     * Expunge any "Emulation Prevention" bytes from a "Raw Byte
     * Sequence Payload"
     * @param data {Uint8Array} the bytes of a RBSP from a NAL
     * unit
     * @return {Uint8Array} the RBSP without any Emulation
     * Prevention Bytes
     */


    discardEmulationPreventionBytes = function (data) {
      var length = data.byteLength,
          emulationPreventionBytesPositions = [],
          i = 1,
          newLength,
          newData; // Find all `Emulation Prevention Bytes`

      while (i < length - 2) {
        if (data[i] === 0 && data[i + 1] === 0 && data[i + 2] === 0x03) {
          emulationPreventionBytesPositions.push(i + 2);
          i += 2;
        } else {
          i++;
        }
      } // If no Emulation Prevention Bytes were found just return the original
      // array


      if (emulationPreventionBytesPositions.length === 0) {
        return data;
      } // Create a new array to hold the NAL unit data


      newLength = length - emulationPreventionBytesPositions.length;
      newData = new Uint8Array(newLength);
      var sourceIndex = 0;

      for (i = 0; i < newLength; sourceIndex++, i++) {
        if (sourceIndex === emulationPreventionBytesPositions[0]) {
          // Skip this byte
          sourceIndex++; // Remove this position index

          emulationPreventionBytesPositions.shift();
        }

        newData[i] = data[sourceIndex];
      }

      return newData;
    };
    /**
     * Read a sequence parameter set and return some interesting video
     * properties. A sequence parameter set is the H264 metadata that
     * describes the properties of upcoming video frames.
     * @param data {Uint8Array} the bytes of a sequence parameter set
     * @return {object} an object with configuration parsed from the
     * sequence parameter set, including the dimensions of the
     * associated video frames.
     */


    readSequenceParameterSet = function (data) {
      var frameCropLeftOffset = 0,
          frameCropRightOffset = 0,
          frameCropTopOffset = 0,
          frameCropBottomOffset = 0,
          expGolombDecoder,
          profileIdc,
          levelIdc,
          profileCompatibility,
          chromaFormatIdc,
          picOrderCntType,
          numRefFramesInPicOrderCntCycle,
          picWidthInMbsMinus1,
          picHeightInMapUnitsMinus1,
          frameMbsOnlyFlag,
          scalingListCount,
          sarRatio = [1, 1],
          aspectRatioIdc,
          i;
      expGolombDecoder = new ExpGolomb(data);
      profileIdc = expGolombDecoder.readUnsignedByte(); // profile_idc

      profileCompatibility = expGolombDecoder.readUnsignedByte(); // constraint_set[0-5]_flag

      levelIdc = expGolombDecoder.readUnsignedByte(); // level_idc u(8)

      expGolombDecoder.skipUnsignedExpGolomb(); // seq_parameter_set_id
      // some profiles have more optional data we don't need

      if (PROFILES_WITH_OPTIONAL_SPS_DATA[profileIdc]) {
        chromaFormatIdc = expGolombDecoder.readUnsignedExpGolomb();

        if (chromaFormatIdc === 3) {
          expGolombDecoder.skipBits(1); // separate_colour_plane_flag
        }

        expGolombDecoder.skipUnsignedExpGolomb(); // bit_depth_luma_minus8

        expGolombDecoder.skipUnsignedExpGolomb(); // bit_depth_chroma_minus8

        expGolombDecoder.skipBits(1); // qpprime_y_zero_transform_bypass_flag

        if (expGolombDecoder.readBoolean()) {
          // seq_scaling_matrix_present_flag
          scalingListCount = chromaFormatIdc !== 3 ? 8 : 12;

          for (i = 0; i < scalingListCount; i++) {
            if (expGolombDecoder.readBoolean()) {
              // seq_scaling_list_present_flag[ i ]
              if (i < 6) {
                skipScalingList(16, expGolombDecoder);
              } else {
                skipScalingList(64, expGolombDecoder);
              }
            }
          }
        }
      }

      expGolombDecoder.skipUnsignedExpGolomb(); // log2_max_frame_num_minus4

      picOrderCntType = expGolombDecoder.readUnsignedExpGolomb();

      if (picOrderCntType === 0) {
        expGolombDecoder.readUnsignedExpGolomb(); // log2_max_pic_order_cnt_lsb_minus4
      } else if (picOrderCntType === 1) {
        expGolombDecoder.skipBits(1); // delta_pic_order_always_zero_flag

        expGolombDecoder.skipExpGolomb(); // offset_for_non_ref_pic

        expGolombDecoder.skipExpGolomb(); // offset_for_top_to_bottom_field

        numRefFramesInPicOrderCntCycle = expGolombDecoder.readUnsignedExpGolomb();

        for (i = 0; i < numRefFramesInPicOrderCntCycle; i++) {
          expGolombDecoder.skipExpGolomb(); // offset_for_ref_frame[ i ]
        }
      }

      expGolombDecoder.skipUnsignedExpGolomb(); // max_num_ref_frames

      expGolombDecoder.skipBits(1); // gaps_in_frame_num_value_allowed_flag

      picWidthInMbsMinus1 = expGolombDecoder.readUnsignedExpGolomb();
      picHeightInMapUnitsMinus1 = expGolombDecoder.readUnsignedExpGolomb();
      frameMbsOnlyFlag = expGolombDecoder.readBits(1);

      if (frameMbsOnlyFlag === 0) {
        expGolombDecoder.skipBits(1); // mb_adaptive_frame_field_flag
      }

      expGolombDecoder.skipBits(1); // direct_8x8_inference_flag

      if (expGolombDecoder.readBoolean()) {
        // frame_cropping_flag
        frameCropLeftOffset = expGolombDecoder.readUnsignedExpGolomb();
        frameCropRightOffset = expGolombDecoder.readUnsignedExpGolomb();
        frameCropTopOffset = expGolombDecoder.readUnsignedExpGolomb();
        frameCropBottomOffset = expGolombDecoder.readUnsignedExpGolomb();
      }

      if (expGolombDecoder.readBoolean()) {
        // vui_parameters_present_flag
        if (expGolombDecoder.readBoolean()) {
          // aspect_ratio_info_present_flag
          aspectRatioIdc = expGolombDecoder.readUnsignedByte();

          switch (aspectRatioIdc) {
            case 1:
              sarRatio = [1, 1];
              break;

            case 2:
              sarRatio = [12, 11];
              break;

            case 3:
              sarRatio = [10, 11];
              break;

            case 4:
              sarRatio = [16, 11];
              break;

            case 5:
              sarRatio = [40, 33];
              break;

            case 6:
              sarRatio = [24, 11];
              break;

            case 7:
              sarRatio = [20, 11];
              break;

            case 8:
              sarRatio = [32, 11];
              break;

            case 9:
              sarRatio = [80, 33];
              break;

            case 10:
              sarRatio = [18, 11];
              break;

            case 11:
              sarRatio = [15, 11];
              break;

            case 12:
              sarRatio = [64, 33];
              break;

            case 13:
              sarRatio = [160, 99];
              break;

            case 14:
              sarRatio = [4, 3];
              break;

            case 15:
              sarRatio = [3, 2];
              break;

            case 16:
              sarRatio = [2, 1];
              break;

            case 255:
              {
                sarRatio = [expGolombDecoder.readUnsignedByte() << 8 | expGolombDecoder.readUnsignedByte(), expGolombDecoder.readUnsignedByte() << 8 | expGolombDecoder.readUnsignedByte()];
                break;
              }
          }

          if (sarRatio) {
            sarRatio[0] / sarRatio[1];
          }
        }
      }

      return {
        profileIdc: profileIdc,
        levelIdc: levelIdc,
        profileCompatibility: profileCompatibility,
        width: (picWidthInMbsMinus1 + 1) * 16 - frameCropLeftOffset * 2 - frameCropRightOffset * 2,
        height: (2 - frameMbsOnlyFlag) * (picHeightInMapUnitsMinus1 + 1) * 16 - frameCropTopOffset * 2 - frameCropBottomOffset * 2,
        // sar is sample aspect ratio
        sarRatio: sarRatio
      };
    };
  };

  H264Stream$1.prototype = new Stream$2();
  var h264 = {
    H264Stream: H264Stream$1,
    NalByteStream: NalByteStream
  };
  /**
   * mux.js
   *
   * Copyright (c) Brightcove
   * Licensed Apache-2.0 https://github.com/videojs/mux.js/blob/master/LICENSE
   *
   * Utilities to detect basic properties and metadata about Aac data.
   */

  var ADTS_SAMPLING_FREQUENCIES = [96000, 88200, 64000, 48000, 44100, 32000, 24000, 22050, 16000, 12000, 11025, 8000, 7350];

  var parseId3TagSize = function (header, byteIndex) {
    var returnSize = header[byteIndex + 6] << 21 | header[byteIndex + 7] << 14 | header[byteIndex + 8] << 7 | header[byteIndex + 9],
        flags = header[byteIndex + 5],
        footerPresent = (flags & 16) >> 4; // if we get a negative returnSize clamp it to 0

    returnSize = returnSize >= 0 ? returnSize : 0;

    if (footerPresent) {
      return returnSize + 20;
    }

    return returnSize + 10;
  };

  var getId3Offset = function (data, offset) {
    if (data.length - offset < 10 || data[offset] !== 'I'.charCodeAt(0) || data[offset + 1] !== 'D'.charCodeAt(0) || data[offset + 2] !== '3'.charCodeAt(0)) {
      return offset;
    }

    offset += parseId3TagSize(data, offset);
    return getId3Offset(data, offset);
  }; // TODO: use vhs-utils


  var isLikelyAacData$1 = function (data) {
    var offset = getId3Offset(data, 0);
    return data.length >= offset + 2 && (data[offset] & 0xFF) === 0xFF && (data[offset + 1] & 0xF0) === 0xF0 && // verify that the 2 layer bits are 0, aka this
    // is not mp3 data but aac data.
    (data[offset + 1] & 0x16) === 0x10;
  };

  var parseSyncSafeInteger = function (data) {
    return data[0] << 21 | data[1] << 14 | data[2] << 7 | data[3];
  }; // return a percent-encoded representation of the specified byte range
  // @see http://en.wikipedia.org/wiki/Percent-encoding


  var percentEncode = function (bytes, start, end) {
    var i,
        result = '';

    for (i = start; i < end; i++) {
      result += '%' + ('00' + bytes[i].toString(16)).slice(-2);
    }

    return result;
  }; // return the string representation of the specified byte range,
  // interpreted as ISO-8859-1.


  var parseIso88591 = function (bytes, start, end) {
    return unescape(percentEncode(bytes, start, end)); // jshint ignore:line
  };

  var parseAdtsSize = function (header, byteIndex) {
    var lowThree = (header[byteIndex + 5] & 0xE0) >> 5,
        middle = header[byteIndex + 4] << 3,
        highTwo = header[byteIndex + 3] & 0x3 << 11;
    return highTwo | middle | lowThree;
  };

  var parseType$4 = function (header, byteIndex) {
    if (header[byteIndex] === 'I'.charCodeAt(0) && header[byteIndex + 1] === 'D'.charCodeAt(0) && header[byteIndex + 2] === '3'.charCodeAt(0)) {
      return 'timed-metadata';
    } else if (header[byteIndex] & 0xff === 0xff && (header[byteIndex + 1] & 0xf0) === 0xf0) {
      return 'audio';
    }

    return null;
  };

  var parseSampleRate = function (packet) {
    var i = 0;

    while (i + 5 < packet.length) {
      if (packet[i] !== 0xFF || (packet[i + 1] & 0xF6) !== 0xF0) {
        // If a valid header was not found,  jump one forward and attempt to
        // find a valid ADTS header starting at the next byte
        i++;
        continue;
      }

      return ADTS_SAMPLING_FREQUENCIES[(packet[i + 2] & 0x3c) >>> 2];
    }

    return null;
  };

  var parseAacTimestamp = function (packet) {
    var frameStart, frameSize, frame, frameHeader; // find the start of the first frame and the end of the tag

    frameStart = 10;

    if (packet[5] & 0x40) {
      // advance the frame start past the extended header
      frameStart += 4; // header size field

      frameStart += parseSyncSafeInteger(packet.subarray(10, 14));
    } // parse one or more ID3 frames
    // http://id3.org/id3v2.3.0#ID3v2_frame_overview


    do {
      // determine the number of bytes in this frame
      frameSize = parseSyncSafeInteger(packet.subarray(frameStart + 4, frameStart + 8));

      if (frameSize < 1) {
        return null;
      }

      frameHeader = String.fromCharCode(packet[frameStart], packet[frameStart + 1], packet[frameStart + 2], packet[frameStart + 3]);

      if (frameHeader === 'PRIV') {
        frame = packet.subarray(frameStart + 10, frameStart + frameSize + 10);

        for (var i = 0; i < frame.byteLength; i++) {
          if (frame[i] === 0) {
            var owner = parseIso88591(frame, 0, i);

            if (owner === 'com.apple.streaming.transportStreamTimestamp') {
              var d = frame.subarray(i + 1);
              var size = (d[3] & 0x01) << 30 | d[4] << 22 | d[5] << 14 | d[6] << 6 | d[7] >>> 2;
              size *= 4;
              size += d[7] & 0x03;
              return size;
            }

            break;
          }
        }
      }

      frameStart += 10; // advance past the frame header

      frameStart += frameSize; // advance past the frame body
    } while (frameStart < packet.byteLength);

    return null;
  };

  var utils = {
    isLikelyAacData: isLikelyAacData$1,
    parseId3TagSize: parseId3TagSize,
    parseAdtsSize: parseAdtsSize,
    parseType: parseType$4,
    parseSampleRate: parseSampleRate,
    parseAacTimestamp: parseAacTimestamp
  };
  /**
   * mux.js
   *
   * Copyright (c) Brightcove
   * Licensed Apache-2.0 https://github.com/videojs/mux.js/blob/master/LICENSE
   *
   * A stream-based aac to mp4 converter. This utility can be used to
   * deliver mp4s to a SourceBuffer on platforms that support native
   * Media Source Extensions.
   */

  var Stream$1 = stream;
  var aacUtils = utils; // Constants

  var AacStream$1;
  /**
   * Splits an incoming stream of binary data into ADTS and ID3 Frames.
   */

  AacStream$1 = function () {
    var everything = new Uint8Array(),
        timeStamp = 0;
    AacStream$1.prototype.init.call(this);

    this.setTimestamp = function (timestamp) {
      timeStamp = timestamp;
    };

    this.push = function (bytes) {
      var frameSize = 0,
          byteIndex = 0,
          bytesLeft,
          chunk,
          packet,
          tempLength; // If there are bytes remaining from the last segment, prepend them to the
      // bytes that were pushed in

      if (everything.length) {
        tempLength = everything.length;
        everything = new Uint8Array(bytes.byteLength + tempLength);
        everything.set(everything.subarray(0, tempLength));
        everything.set(bytes, tempLength);
      } else {
        everything = bytes;
      }

      while (everything.length - byteIndex >= 3) {
        if (everything[byteIndex] === 'I'.charCodeAt(0) && everything[byteIndex + 1] === 'D'.charCodeAt(0) && everything[byteIndex + 2] === '3'.charCodeAt(0)) {
          // Exit early because we don't have enough to parse
          // the ID3 tag header
          if (everything.length - byteIndex < 10) {
            break;
          } // check framesize


          frameSize = aacUtils.parseId3TagSize(everything, byteIndex); // Exit early if we don't have enough in the buffer
          // to emit a full packet
          // Add to byteIndex to support multiple ID3 tags in sequence

          if (byteIndex + frameSize > everything.length) {
            break;
          }

          chunk = {
            type: 'timed-metadata',
            data: everything.subarray(byteIndex, byteIndex + frameSize)
          };
          this.trigger('data', chunk);
          byteIndex += frameSize;
          continue;
        } else if ((everything[byteIndex] & 0xff) === 0xff && (everything[byteIndex + 1] & 0xf0) === 0xf0) {
          // Exit early because we don't have enough to parse
          // the ADTS frame header
          if (everything.length - byteIndex < 7) {
            break;
          }

          frameSize = aacUtils.parseAdtsSize(everything, byteIndex); // Exit early if we don't have enough in the buffer
          // to emit a full packet

          if (byteIndex + frameSize > everything.length) {
            break;
          }

          packet = {
            type: 'audio',
            data: everything.subarray(byteIndex, byteIndex + frameSize),
            pts: timeStamp,
            dts: timeStamp
          };
          this.trigger('data', packet);
          byteIndex += frameSize;
          continue;
        }

        byteIndex++;
      }

      bytesLeft = everything.length - byteIndex;

      if (bytesLeft > 0) {
        everything = everything.subarray(byteIndex);
      } else {
        everything = new Uint8Array();
      }
    };

    this.reset = function () {
      everything = new Uint8Array();
      this.trigger('reset');
    };

    this.endTimeline = function () {
      everything = new Uint8Array();
      this.trigger('endedtimeline');
    };
  };

  AacStream$1.prototype = new Stream$1();
  var aac = AacStream$1;
  var AUDIO_PROPERTIES$1 = ['audioobjecttype', 'channelcount', 'samplerate', 'samplingfrequencyindex', 'samplesize'];
  var audioProperties = AUDIO_PROPERTIES$1;
  var VIDEO_PROPERTIES$1 = ['width', 'height', 'profileIdc', 'levelIdc', 'profileCompatibility', 'sarRatio'];
  var videoProperties = VIDEO_PROPERTIES$1;
  /**
   * mux.js
   *
   * Copyright (c) Brightcove
   * Licensed Apache-2.0 https://github.com/videojs/mux.js/blob/master/LICENSE
   *
   * A stream-based mp2t to mp4 converter. This utility can be used to
   * deliver mp4s to a SourceBuffer on platforms that support native
   * Media Source Extensions.
   */

  var Stream = stream;
  var mp4 = mp4Generator;
  var frameUtils = frameUtils$1;
  var audioFrameUtils = audioFrameUtils$1;
  var trackDecodeInfo = trackDecodeInfo$1;
  var m2ts = m2ts_1;
  var clock = clock$2;
  var AdtsStream = adts;
  var H264Stream = h264.H264Stream;
  var AacStream = aac;
  var isLikelyAacData = utils.isLikelyAacData;
  var ONE_SECOND_IN_TS$1 = clock$2.ONE_SECOND_IN_TS;
  var AUDIO_PROPERTIES = audioProperties;
  var VIDEO_PROPERTIES = videoProperties; // object types

  var VideoSegmentStream, AudioSegmentStream, Transmuxer, CoalesceStream;

  var retriggerForStream = function (key, event) {
    event.stream = key;
    this.trigger('log', event);
  };

  var addPipelineLogRetriggers = function (transmuxer, pipeline) {
    var keys = Object.keys(pipeline);

    for (var i = 0; i < keys.length; i++) {
      var key = keys[i]; // skip non-stream keys and headOfPipeline
      // which is just a duplicate

      if (key === 'headOfPipeline' || !pipeline[key].on) {
        continue;
      }

      pipeline[key].on('log', retriggerForStream.bind(transmuxer, key));
    }
  };
  /**
   * Compare two arrays (even typed) for same-ness
   */


  var arrayEquals = function (a, b) {
    var i;

    if (a.length !== b.length) {
      return false;
    } // compare the value of each element in the array


    for (i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) {
        return false;
      }
    }

    return true;
  };

  var generateSegmentTimingInfo = function (baseMediaDecodeTime, startDts, startPts, endDts, endPts, prependedContentDuration) {
    var ptsOffsetFromDts = startPts - startDts,
        decodeDuration = endDts - startDts,
        presentationDuration = endPts - startPts; // The PTS and DTS values are based on the actual stream times from the segment,
    // however, the player time values will reflect a start from the baseMediaDecodeTime.
    // In order to provide relevant values for the player times, base timing info on the
    // baseMediaDecodeTime and the DTS and PTS durations of the segment.

    return {
      start: {
        dts: baseMediaDecodeTime,
        pts: baseMediaDecodeTime + ptsOffsetFromDts
      },
      end: {
        dts: baseMediaDecodeTime + decodeDuration,
        pts: baseMediaDecodeTime + presentationDuration
      },
      prependedContentDuration: prependedContentDuration,
      baseMediaDecodeTime: baseMediaDecodeTime
    };
  };
  /**
   * Constructs a single-track, ISO BMFF media segment from AAC data
   * events. The output of this stream can be fed to a SourceBuffer
   * configured with a suitable initialization segment.
   * @param track {object} track metadata configuration
   * @param options {object} transmuxer options object
   * @param options.keepOriginalTimestamps {boolean} If true, keep the timestamps
   *        in the source; false to adjust the first segment to start at 0.
   */


  AudioSegmentStream = function (track, options) {
    var adtsFrames = [],
        sequenceNumber,
        earliestAllowedDts = 0,
        audioAppendStartTs = 0,
        videoBaseMediaDecodeTime = Infinity;
    options = options || {};
    sequenceNumber = options.firstSequenceNumber || 0;
    AudioSegmentStream.prototype.init.call(this);

    this.push = function (data) {
      trackDecodeInfo.collectDtsInfo(track, data);

      if (track) {
        AUDIO_PROPERTIES.forEach(function (prop) {
          track[prop] = data[prop];
        });
      } // buffer audio data until end() is called


      adtsFrames.push(data);
    };

    this.setEarliestDts = function (earliestDts) {
      earliestAllowedDts = earliestDts;
    };

    this.setVideoBaseMediaDecodeTime = function (baseMediaDecodeTime) {
      videoBaseMediaDecodeTime = baseMediaDecodeTime;
    };

    this.setAudioAppendStart = function (timestamp) {
      audioAppendStartTs = timestamp;
    };

    this.flush = function () {
      var frames, moof, mdat, boxes, frameDuration, segmentDuration, videoClockCyclesOfSilencePrefixed; // return early if no audio data has been observed

      if (adtsFrames.length === 0) {
        this.trigger('done', 'AudioSegmentStream');
        return;
      }

      frames = audioFrameUtils.trimAdtsFramesByEarliestDts(adtsFrames, track, earliestAllowedDts);
      track.baseMediaDecodeTime = trackDecodeInfo.calculateTrackBaseMediaDecodeTime(track, options.keepOriginalTimestamps); // amount of audio filled but the value is in video clock rather than audio clock

      videoClockCyclesOfSilencePrefixed = audioFrameUtils.prefixWithSilence(track, frames, audioAppendStartTs, videoBaseMediaDecodeTime); // we have to build the index from byte locations to
      // samples (that is, adts frames) in the audio data

      track.samples = audioFrameUtils.generateSampleTable(frames); // concatenate the audio data to constuct the mdat

      mdat = mp4.mdat(audioFrameUtils.concatenateFrameData(frames));
      adtsFrames = [];
      moof = mp4.moof(sequenceNumber, [track]);
      boxes = new Uint8Array(moof.byteLength + mdat.byteLength); // bump the sequence number for next time

      sequenceNumber++;
      boxes.set(moof);
      boxes.set(mdat, moof.byteLength);
      trackDecodeInfo.clearDtsInfo(track);
      frameDuration = Math.ceil(ONE_SECOND_IN_TS$1 * 1024 / track.samplerate); // TODO this check was added to maintain backwards compatibility (particularly with
      // tests) on adding the timingInfo event. However, it seems unlikely that there's a
      // valid use-case where an init segment/data should be triggered without associated
      // frames. Leaving for now, but should be looked into.

      if (frames.length) {
        segmentDuration = frames.length * frameDuration;
        this.trigger('segmentTimingInfo', generateSegmentTimingInfo( // The audio track's baseMediaDecodeTime is in audio clock cycles, but the
        // frame info is in video clock cycles. Convert to match expectation of
        // listeners (that all timestamps will be based on video clock cycles).
        clock.audioTsToVideoTs(track.baseMediaDecodeTime, track.samplerate), // frame times are already in video clock, as is segment duration
        frames[0].dts, frames[0].pts, frames[0].dts + segmentDuration, frames[0].pts + segmentDuration, videoClockCyclesOfSilencePrefixed || 0));
        this.trigger('timingInfo', {
          start: frames[0].pts,
          end: frames[0].pts + segmentDuration
        });
      }

      this.trigger('data', {
        track: track,
        boxes: boxes
      });
      this.trigger('done', 'AudioSegmentStream');
    };

    this.reset = function () {
      trackDecodeInfo.clearDtsInfo(track);
      adtsFrames = [];
      this.trigger('reset');
    };
  };

  AudioSegmentStream.prototype = new Stream();
  /**
   * Constructs a single-track, ISO BMFF media segment from H264 data
   * events. The output of this stream can be fed to a SourceBuffer
   * configured with a suitable initialization segment.
   * @param track {object} track metadata configuration
   * @param options {object} transmuxer options object
   * @param options.alignGopsAtEnd {boolean} If true, start from the end of the
   *        gopsToAlignWith list when attempting to align gop pts
   * @param options.keepOriginalTimestamps {boolean} If true, keep the timestamps
   *        in the source; false to adjust the first segment to start at 0.
   */

  VideoSegmentStream = function (track, options) {
    var sequenceNumber,
        nalUnits = [],
        gopsToAlignWith = [],
        config,
        pps;
    options = options || {};
    sequenceNumber = options.firstSequenceNumber || 0;
    VideoSegmentStream.prototype.init.call(this);
    delete track.minPTS;
    this.gopCache_ = [];
    /**
      * Constructs a ISO BMFF segment given H264 nalUnits
      * @param {Object} nalUnit A data event representing a nalUnit
      * @param {String} nalUnit.nalUnitType
      * @param {Object} nalUnit.config Properties for a mp4 track
      * @param {Uint8Array} nalUnit.data The nalUnit bytes
      * @see lib/codecs/h264.js
     **/

    this.push = function (nalUnit) {
      trackDecodeInfo.collectDtsInfo(track, nalUnit); // record the track config

      if (nalUnit.nalUnitType === 'seq_parameter_set_rbsp' && !config) {
        config = nalUnit.config;
        track.sps = [nalUnit.data];
        VIDEO_PROPERTIES.forEach(function (prop) {
          track[prop] = config[prop];
        }, this);
      }

      if (nalUnit.nalUnitType === 'pic_parameter_set_rbsp' && !pps) {
        pps = nalUnit.data;
        track.pps = [nalUnit.data];
      } // buffer video until flush() is called


      nalUnits.push(nalUnit);
    };
    /**
      * Pass constructed ISO BMFF track and boxes on to the
      * next stream in the pipeline
     **/


    this.flush = function () {
      var frames,
          gopForFusion,
          gops,
          moof,
          mdat,
          boxes,
          prependedContentDuration = 0,
          firstGop,
          lastGop; // Throw away nalUnits at the start of the byte stream until
      // we find the first AUD

      while (nalUnits.length) {
        if (nalUnits[0].nalUnitType === 'access_unit_delimiter_rbsp') {
          break;
        }

        nalUnits.shift();
      } // Return early if no video data has been observed


      if (nalUnits.length === 0) {
        this.resetStream_();
        this.trigger('done', 'VideoSegmentStream');
        return;
      } // Organize the raw nal-units into arrays that represent
      // higher-level constructs such as frames and gops
      // (group-of-pictures)


      frames = frameUtils.groupNalsIntoFrames(nalUnits);
      gops = frameUtils.groupFramesIntoGops(frames); // If the first frame of this fragment is not a keyframe we have
      // a problem since MSE (on Chrome) requires a leading keyframe.
      //
      // We have two approaches to repairing this situation:
      // 1) GOP-FUSION:
      //    This is where we keep track of the GOPS (group-of-pictures)
      //    from previous fragments and attempt to find one that we can
      //    prepend to the current fragment in order to create a valid
      //    fragment.
      // 2) KEYFRAME-PULLING:
      //    Here we search for the first keyframe in the fragment and
      //    throw away all the frames between the start of the fragment
      //    and that keyframe. We then extend the duration and pull the
      //    PTS of the keyframe forward so that it covers the time range
      //    of the frames that were disposed of.
      //
      // #1 is far prefereable over #2 which can cause "stuttering" but
      // requires more things to be just right.

      if (!gops[0][0].keyFrame) {
        // Search for a gop for fusion from our gopCache
        gopForFusion = this.getGopForFusion_(nalUnits[0], track);

        if (gopForFusion) {
          // in order to provide more accurate timing information about the segment, save
          // the number of seconds prepended to the original segment due to GOP fusion
          prependedContentDuration = gopForFusion.duration;
          gops.unshift(gopForFusion); // Adjust Gops' metadata to account for the inclusion of the
          // new gop at the beginning

          gops.byteLength += gopForFusion.byteLength;
          gops.nalCount += gopForFusion.nalCount;
          gops.pts = gopForFusion.pts;
          gops.dts = gopForFusion.dts;
          gops.duration += gopForFusion.duration;
        } else {
          // If we didn't find a candidate gop fall back to keyframe-pulling
          gops = frameUtils.extendFirstKeyFrame(gops);
        }
      } // Trim gops to align with gopsToAlignWith


      if (gopsToAlignWith.length) {
        var alignedGops;

        if (options.alignGopsAtEnd) {
          alignedGops = this.alignGopsAtEnd_(gops);
        } else {
          alignedGops = this.alignGopsAtStart_(gops);
        }

        if (!alignedGops) {
          // save all the nals in the last GOP into the gop cache
          this.gopCache_.unshift({
            gop: gops.pop(),
            pps: track.pps,
            sps: track.sps
          }); // Keep a maximum of 6 GOPs in the cache

          this.gopCache_.length = Math.min(6, this.gopCache_.length); // Clear nalUnits

          nalUnits = []; // return early no gops can be aligned with desired gopsToAlignWith

          this.resetStream_();
          this.trigger('done', 'VideoSegmentStream');
          return;
        } // Some gops were trimmed. clear dts info so minSegmentDts and pts are correct
        // when recalculated before sending off to CoalesceStream


        trackDecodeInfo.clearDtsInfo(track);
        gops = alignedGops;
      }

      trackDecodeInfo.collectDtsInfo(track, gops); // First, we have to build the index from byte locations to
      // samples (that is, frames) in the video data

      track.samples = frameUtils.generateSampleTable(gops); // Concatenate the video data and construct the mdat

      mdat = mp4.mdat(frameUtils.concatenateNalData(gops));
      track.baseMediaDecodeTime = trackDecodeInfo.calculateTrackBaseMediaDecodeTime(track, options.keepOriginalTimestamps);
      this.trigger('processedGopsInfo', gops.map(function (gop) {
        return {
          pts: gop.pts,
          dts: gop.dts,
          byteLength: gop.byteLength
        };
      }));
      firstGop = gops[0];
      lastGop = gops[gops.length - 1];
      this.trigger('segmentTimingInfo', generateSegmentTimingInfo(track.baseMediaDecodeTime, firstGop.dts, firstGop.pts, lastGop.dts + lastGop.duration, lastGop.pts + lastGop.duration, prependedContentDuration));
      this.trigger('timingInfo', {
        start: gops[0].pts,
        end: gops[gops.length - 1].pts + gops[gops.length - 1].duration
      }); // save all the nals in the last GOP into the gop cache

      this.gopCache_.unshift({
        gop: gops.pop(),
        pps: track.pps,
        sps: track.sps
      }); // Keep a maximum of 6 GOPs in the cache

      this.gopCache_.length = Math.min(6, this.gopCache_.length); // Clear nalUnits

      nalUnits = [];
      this.trigger('baseMediaDecodeTime', track.baseMediaDecodeTime);
      this.trigger('timelineStartInfo', track.timelineStartInfo);
      moof = mp4.moof(sequenceNumber, [track]); // it would be great to allocate this array up front instead of
      // throwing away hundreds of media segment fragments

      boxes = new Uint8Array(moof.byteLength + mdat.byteLength); // Bump the sequence number for next time

      sequenceNumber++;
      boxes.set(moof);
      boxes.set(mdat, moof.byteLength);
      this.trigger('data', {
        track: track,
        boxes: boxes
      });
      this.resetStream_(); // Continue with the flush process now

      this.trigger('done', 'VideoSegmentStream');
    };

    this.reset = function () {
      this.resetStream_();
      nalUnits = [];
      this.gopCache_.length = 0;
      gopsToAlignWith.length = 0;
      this.trigger('reset');
    };

    this.resetStream_ = function () {
      trackDecodeInfo.clearDtsInfo(track); // reset config and pps because they may differ across segments
      // for instance, when we are rendition switching

      config = undefined;
      pps = undefined;
    }; // Search for a candidate Gop for gop-fusion from the gop cache and
    // return it or return null if no good candidate was found


    this.getGopForFusion_ = function (nalUnit) {
      var halfSecond = 45000,
          // Half-a-second in a 90khz clock
      allowableOverlap = 10000,
          // About 3 frames @ 30fps
      nearestDistance = Infinity,
          dtsDistance,
          nearestGopObj,
          currentGop,
          currentGopObj,
          i; // Search for the GOP nearest to the beginning of this nal unit

      for (i = 0; i < this.gopCache_.length; i++) {
        currentGopObj = this.gopCache_[i];
        currentGop = currentGopObj.gop; // Reject Gops with different SPS or PPS

        if (!(track.pps && arrayEquals(track.pps[0], currentGopObj.pps[0])) || !(track.sps && arrayEquals(track.sps[0], currentGopObj.sps[0]))) {
          continue;
        } // Reject Gops that would require a negative baseMediaDecodeTime


        if (currentGop.dts < track.timelineStartInfo.dts) {
          continue;
        } // The distance between the end of the gop and the start of the nalUnit


        dtsDistance = nalUnit.dts - currentGop.dts - currentGop.duration; // Only consider GOPS that start before the nal unit and end within
        // a half-second of the nal unit

        if (dtsDistance >= -allowableOverlap && dtsDistance <= halfSecond) {
          // Always use the closest GOP we found if there is more than
          // one candidate
          if (!nearestGopObj || nearestDistance > dtsDistance) {
            nearestGopObj = currentGopObj;
            nearestDistance = dtsDistance;
          }
        }
      }

      if (nearestGopObj) {
        return nearestGopObj.gop;
      }

      return null;
    }; // trim gop list to the first gop found that has a matching pts with a gop in the list
    // of gopsToAlignWith starting from the START of the list


    this.alignGopsAtStart_ = function (gops) {
      var alignIndex, gopIndex, align, gop, byteLength, nalCount, duration, alignedGops;
      byteLength = gops.byteLength;
      nalCount = gops.nalCount;
      duration = gops.duration;
      alignIndex = gopIndex = 0;

      while (alignIndex < gopsToAlignWith.length && gopIndex < gops.length) {
        align = gopsToAlignWith[alignIndex];
        gop = gops[gopIndex];

        if (align.pts === gop.pts) {
          break;
        }

        if (gop.pts > align.pts) {
          // this current gop starts after the current gop we want to align on, so increment
          // align index
          alignIndex++;
          continue;
        } // current gop starts before the current gop we want to align on. so increment gop
        // index


        gopIndex++;
        byteLength -= gop.byteLength;
        nalCount -= gop.nalCount;
        duration -= gop.duration;
      }

      if (gopIndex === 0) {
        // no gops to trim
        return gops;
      }

      if (gopIndex === gops.length) {
        // all gops trimmed, skip appending all gops
        return null;
      }

      alignedGops = gops.slice(gopIndex);
      alignedGops.byteLength = byteLength;
      alignedGops.duration = duration;
      alignedGops.nalCount = nalCount;
      alignedGops.pts = alignedGops[0].pts;
      alignedGops.dts = alignedGops[0].dts;
      return alignedGops;
    }; // trim gop list to the first gop found that has a matching pts with a gop in the list
    // of gopsToAlignWith starting from the END of the list


    this.alignGopsAtEnd_ = function (gops) {
      var alignIndex, gopIndex, align, gop, alignEndIndex, matchFound;
      alignIndex = gopsToAlignWith.length - 1;
      gopIndex = gops.length - 1;
      alignEndIndex = null;
      matchFound = false;

      while (alignIndex >= 0 && gopIndex >= 0) {
        align = gopsToAlignWith[alignIndex];
        gop = gops[gopIndex];

        if (align.pts === gop.pts) {
          matchFound = true;
          break;
        }

        if (align.pts > gop.pts) {
          alignIndex--;
          continue;
        }

        if (alignIndex === gopsToAlignWith.length - 1) {
          // gop.pts is greater than the last alignment candidate. If no match is found
          // by the end of this loop, we still want to append gops that come after this
          // point
          alignEndIndex = gopIndex;
        }

        gopIndex--;
      }

      if (!matchFound && alignEndIndex === null) {
        return null;
      }

      var trimIndex;

      if (matchFound) {
        trimIndex = gopIndex;
      } else {
        trimIndex = alignEndIndex;
      }

      if (trimIndex === 0) {
        return gops;
      }

      var alignedGops = gops.slice(trimIndex);
      var metadata = alignedGops.reduce(function (total, gop) {
        total.byteLength += gop.byteLength;
        total.duration += gop.duration;
        total.nalCount += gop.nalCount;
        return total;
      }, {
        byteLength: 0,
        duration: 0,
        nalCount: 0
      });
      alignedGops.byteLength = metadata.byteLength;
      alignedGops.duration = metadata.duration;
      alignedGops.nalCount = metadata.nalCount;
      alignedGops.pts = alignedGops[0].pts;
      alignedGops.dts = alignedGops[0].dts;
      return alignedGops;
    };

    this.alignGopsWith = function (newGopsToAlignWith) {
      gopsToAlignWith = newGopsToAlignWith;
    };
  };

  VideoSegmentStream.prototype = new Stream();
  /**
   * A Stream that can combine multiple streams (ie. audio & video)
   * into a single output segment for MSE. Also supports audio-only
   * and video-only streams.
   * @param options {object} transmuxer options object
   * @param options.keepOriginalTimestamps {boolean} If true, keep the timestamps
   *        in the source; false to adjust the first segment to start at media timeline start.
   */

  CoalesceStream = function (options, metadataStream) {
    // Number of Tracks per output segment
    // If greater than 1, we combine multiple
    // tracks into a single segment
    this.numberOfTracks = 0;
    this.metadataStream = metadataStream;
    options = options || {};

    if (typeof options.remux !== 'undefined') {
      this.remuxTracks = !!options.remux;
    } else {
      this.remuxTracks = true;
    }

    if (typeof options.keepOriginalTimestamps === 'boolean') {
      this.keepOriginalTimestamps = options.keepOriginalTimestamps;
    } else {
      this.keepOriginalTimestamps = false;
    }

    this.pendingTracks = [];
    this.videoTrack = null;
    this.pendingBoxes = [];
    this.pendingCaptions = [];
    this.pendingMetadata = [];
    this.pendingBytes = 0;
    this.emittedTracks = 0;
    CoalesceStream.prototype.init.call(this); // Take output from multiple

    this.push = function (output) {
      // buffer incoming captions until the associated video segment
      // finishes
      if (output.content || output.text) {
        return this.pendingCaptions.push(output);
      } // buffer incoming id3 tags until the final flush


      if (output.frames) {
        return this.pendingMetadata.push(output);
      } // Add this track to the list of pending tracks and store
      // important information required for the construction of
      // the final segment


      this.pendingTracks.push(output.track);
      this.pendingBytes += output.boxes.byteLength; // TODO: is there an issue for this against chrome?
      // We unshift audio and push video because
      // as of Chrome 75 when switching from
      // one init segment to another if the video
      // mdat does not appear after the audio mdat
      // only audio will play for the duration of our transmux.

      if (output.track.type === 'video') {
        this.videoTrack = output.track;
        this.pendingBoxes.push(output.boxes);
      }

      if (output.track.type === 'audio') {
        this.audioTrack = output.track;
        this.pendingBoxes.unshift(output.boxes);
      }
    };
  };

  CoalesceStream.prototype = new Stream();

  CoalesceStream.prototype.flush = function (flushSource) {
    var offset = 0,
        event = {
      captions: [],
      captionStreams: {},
      metadata: [],
      info: {}
    },
        caption,
        id3,
        initSegment,
        timelineStartPts = 0,
        i;

    if (this.pendingTracks.length < this.numberOfTracks) {
      if (flushSource !== 'VideoSegmentStream' && flushSource !== 'AudioSegmentStream') {
        // Return because we haven't received a flush from a data-generating
        // portion of the segment (meaning that we have only recieved meta-data
        // or captions.)
        return;
      } else if (this.remuxTracks) {
        // Return until we have enough tracks from the pipeline to remux (if we
        // are remuxing audio and video into a single MP4)
        return;
      } else if (this.pendingTracks.length === 0) {
        // In the case where we receive a flush without any data having been
        // received we consider it an emitted track for the purposes of coalescing
        // `done` events.
        // We do this for the case where there is an audio and video track in the
        // segment but no audio data. (seen in several playlists with alternate
        // audio tracks and no audio present in the main TS segments.)
        this.emittedTracks++;

        if (this.emittedTracks >= this.numberOfTracks) {
          this.trigger('done');
          this.emittedTracks = 0;
        }

        return;
      }
    }

    if (this.videoTrack) {
      timelineStartPts = this.videoTrack.timelineStartInfo.pts;
      VIDEO_PROPERTIES.forEach(function (prop) {
        event.info[prop] = this.videoTrack[prop];
      }, this);
    } else if (this.audioTrack) {
      timelineStartPts = this.audioTrack.timelineStartInfo.pts;
      AUDIO_PROPERTIES.forEach(function (prop) {
        event.info[prop] = this.audioTrack[prop];
      }, this);
    }

    if (this.videoTrack || this.audioTrack) {
      if (this.pendingTracks.length === 1) {
        event.type = this.pendingTracks[0].type;
      } else {
        event.type = 'combined';
      }

      this.emittedTracks += this.pendingTracks.length;
      initSegment = mp4.initSegment(this.pendingTracks); // Create a new typed array to hold the init segment

      event.initSegment = new Uint8Array(initSegment.byteLength); // Create an init segment containing a moov
      // and track definitions

      event.initSegment.set(initSegment); // Create a new typed array to hold the moof+mdats

      event.data = new Uint8Array(this.pendingBytes); // Append each moof+mdat (one per track) together

      for (i = 0; i < this.pendingBoxes.length; i++) {
        event.data.set(this.pendingBoxes[i], offset);
        offset += this.pendingBoxes[i].byteLength;
      } // Translate caption PTS times into second offsets to match the
      // video timeline for the segment, and add track info


      for (i = 0; i < this.pendingCaptions.length; i++) {
        caption = this.pendingCaptions[i];
        caption.startTime = clock.metadataTsToSeconds(caption.startPts, timelineStartPts, this.keepOriginalTimestamps);
        caption.endTime = clock.metadataTsToSeconds(caption.endPts, timelineStartPts, this.keepOriginalTimestamps);
        event.captionStreams[caption.stream] = true;
        event.captions.push(caption);
      } // Translate ID3 frame PTS times into second offsets to match the
      // video timeline for the segment


      for (i = 0; i < this.pendingMetadata.length; i++) {
        id3 = this.pendingMetadata[i];
        id3.cueTime = clock.metadataTsToSeconds(id3.pts, timelineStartPts, this.keepOriginalTimestamps);
        event.metadata.push(id3);
      } // We add this to every single emitted segment even though we only need
      // it for the first


      event.metadata.dispatchType = this.metadataStream.dispatchType; // Reset stream state

      this.pendingTracks.length = 0;
      this.videoTrack = null;
      this.pendingBoxes.length = 0;
      this.pendingCaptions.length = 0;
      this.pendingBytes = 0;
      this.pendingMetadata.length = 0; // Emit the built segment
      // We include captions and ID3 tags for backwards compatibility,
      // ideally we should send only video and audio in the data event

      this.trigger('data', event); // Emit each caption to the outside world
      // Ideally, this would happen immediately on parsing captions,
      // but we need to ensure that video data is sent back first
      // so that caption timing can be adjusted to match video timing

      for (i = 0; i < event.captions.length; i++) {
        caption = event.captions[i];
        this.trigger('caption', caption);
      } // Emit each id3 tag to the outside world
      // Ideally, this would happen immediately on parsing the tag,
      // but we need to ensure that video data is sent back first
      // so that ID3 frame timing can be adjusted to match video timing


      for (i = 0; i < event.metadata.length; i++) {
        id3 = event.metadata[i];
        this.trigger('id3Frame', id3);
      }
    } // Only emit `done` if all tracks have been flushed and emitted


    if (this.emittedTracks >= this.numberOfTracks) {
      this.trigger('done');
      this.emittedTracks = 0;
    }
  };

  CoalesceStream.prototype.setRemux = function (val) {
    this.remuxTracks = val;
  };
  /**
   * A Stream that expects MP2T binary data as input and produces
   * corresponding media segments, suitable for use with Media Source
   * Extension (MSE) implementations that support the ISO BMFF byte
   * stream format, like Chrome.
   */


  Transmuxer = function (options) {
    var self = this,
        hasFlushed = true,
        videoTrack,
        audioTrack;
    Transmuxer.prototype.init.call(this);
    options = options || {};
    this.baseMediaDecodeTime = options.baseMediaDecodeTime || 0;
    this.transmuxPipeline_ = {};

    this.setupAacPipeline = function () {
      var pipeline = {};
      this.transmuxPipeline_ = pipeline;
      pipeline.type = 'aac';
      pipeline.metadataStream = new m2ts.MetadataStream(); // set up the parsing pipeline

      pipeline.aacStream = new AacStream();
      pipeline.audioTimestampRolloverStream = new m2ts.TimestampRolloverStream('audio');
      pipeline.timedMetadataTimestampRolloverStream = new m2ts.TimestampRolloverStream('timed-metadata');
      pipeline.adtsStream = new AdtsStream();
      pipeline.coalesceStream = new CoalesceStream(options, pipeline.metadataStream);
      pipeline.headOfPipeline = pipeline.aacStream;
      pipeline.aacStream.pipe(pipeline.audioTimestampRolloverStream).pipe(pipeline.adtsStream);
      pipeline.aacStream.pipe(pipeline.timedMetadataTimestampRolloverStream).pipe(pipeline.metadataStream).pipe(pipeline.coalesceStream);
      pipeline.metadataStream.on('timestamp', function (frame) {
        pipeline.aacStream.setTimestamp(frame.timeStamp);
      });
      pipeline.aacStream.on('data', function (data) {
        if (data.type !== 'timed-metadata' && data.type !== 'audio' || pipeline.audioSegmentStream) {
          return;
        }

        audioTrack = audioTrack || {
          timelineStartInfo: {
            baseMediaDecodeTime: self.baseMediaDecodeTime
          },
          codec: 'adts',
          type: 'audio'
        }; // hook up the audio segment stream to the first track with aac data

        pipeline.coalesceStream.numberOfTracks++;
        pipeline.audioSegmentStream = new AudioSegmentStream(audioTrack, options);
        pipeline.audioSegmentStream.on('log', self.getLogTrigger_('audioSegmentStream'));
        pipeline.audioSegmentStream.on('timingInfo', self.trigger.bind(self, 'audioTimingInfo')); // Set up the final part of the audio pipeline

        pipeline.adtsStream.pipe(pipeline.audioSegmentStream).pipe(pipeline.coalesceStream); // emit pmt info

        self.trigger('trackinfo', {
          hasAudio: !!audioTrack,
          hasVideo: !!videoTrack
        });
      }); // Re-emit any data coming from the coalesce stream to the outside world

      pipeline.coalesceStream.on('data', this.trigger.bind(this, 'data')); // Let the consumer know we have finished flushing the entire pipeline

      pipeline.coalesceStream.on('done', this.trigger.bind(this, 'done'));
      addPipelineLogRetriggers(this, pipeline);
    };

    this.setupTsPipeline = function () {
      var pipeline = {};
      this.transmuxPipeline_ = pipeline;
      pipeline.type = 'ts';
      pipeline.metadataStream = new m2ts.MetadataStream(); // set up the parsing pipeline

      pipeline.packetStream = new m2ts.TransportPacketStream();
      pipeline.parseStream = new m2ts.TransportParseStream();
      pipeline.elementaryStream = new m2ts.ElementaryStream();
      pipeline.timestampRolloverStream = new m2ts.TimestampRolloverStream();
      pipeline.adtsStream = new AdtsStream();
      pipeline.h264Stream = new H264Stream();
      pipeline.captionStream = new m2ts.CaptionStream(options);
      pipeline.coalesceStream = new CoalesceStream(options, pipeline.metadataStream);
      pipeline.headOfPipeline = pipeline.packetStream; // disassemble MPEG2-TS packets into elementary streams

      pipeline.packetStream.pipe(pipeline.parseStream).pipe(pipeline.elementaryStream).pipe(pipeline.timestampRolloverStream); // !!THIS ORDER IS IMPORTANT!!
      // demux the streams

      pipeline.timestampRolloverStream.pipe(pipeline.h264Stream);
      pipeline.timestampRolloverStream.pipe(pipeline.adtsStream);
      pipeline.timestampRolloverStream.pipe(pipeline.metadataStream).pipe(pipeline.coalesceStream); // Hook up CEA-608/708 caption stream

      pipeline.h264Stream.pipe(pipeline.captionStream).pipe(pipeline.coalesceStream);
      pipeline.elementaryStream.on('data', function (data) {
        var i;

        if (data.type === 'metadata') {
          i = data.tracks.length; // scan the tracks listed in the metadata

          while (i--) {
            if (!videoTrack && data.tracks[i].type === 'video') {
              videoTrack = data.tracks[i];
              videoTrack.timelineStartInfo.baseMediaDecodeTime = self.baseMediaDecodeTime;
            } else if (!audioTrack && data.tracks[i].type === 'audio') {
              audioTrack = data.tracks[i];
              audioTrack.timelineStartInfo.baseMediaDecodeTime = self.baseMediaDecodeTime;
            }
          } // hook up the video segment stream to the first track with h264 data


          if (videoTrack && !pipeline.videoSegmentStream) {
            pipeline.coalesceStream.numberOfTracks++;
            pipeline.videoSegmentStream = new VideoSegmentStream(videoTrack, options);
            pipeline.videoSegmentStream.on('log', self.getLogTrigger_('videoSegmentStream'));
            pipeline.videoSegmentStream.on('timelineStartInfo', function (timelineStartInfo) {
              // When video emits timelineStartInfo data after a flush, we forward that
              // info to the AudioSegmentStream, if it exists, because video timeline
              // data takes precedence.  Do not do this if keepOriginalTimestamps is set,
              // because this is a particularly subtle form of timestamp alteration.
              if (audioTrack && !options.keepOriginalTimestamps) {
                audioTrack.timelineStartInfo = timelineStartInfo; // On the first segment we trim AAC frames that exist before the
                // very earliest DTS we have seen in video because Chrome will
                // interpret any video track with a baseMediaDecodeTime that is
                // non-zero as a gap.

                pipeline.audioSegmentStream.setEarliestDts(timelineStartInfo.dts - self.baseMediaDecodeTime);
              }
            });
            pipeline.videoSegmentStream.on('processedGopsInfo', self.trigger.bind(self, 'gopInfo'));
            pipeline.videoSegmentStream.on('segmentTimingInfo', self.trigger.bind(self, 'videoSegmentTimingInfo'));
            pipeline.videoSegmentStream.on('baseMediaDecodeTime', function (baseMediaDecodeTime) {
              if (audioTrack) {
                pipeline.audioSegmentStream.setVideoBaseMediaDecodeTime(baseMediaDecodeTime);
              }
            });
            pipeline.videoSegmentStream.on('timingInfo', self.trigger.bind(self, 'videoTimingInfo')); // Set up the final part of the video pipeline

            pipeline.h264Stream.pipe(pipeline.videoSegmentStream).pipe(pipeline.coalesceStream);
          }

          if (audioTrack && !pipeline.audioSegmentStream) {
            // hook up the audio segment stream to the first track with aac data
            pipeline.coalesceStream.numberOfTracks++;
            pipeline.audioSegmentStream = new AudioSegmentStream(audioTrack, options);
            pipeline.audioSegmentStream.on('log', self.getLogTrigger_('audioSegmentStream'));
            pipeline.audioSegmentStream.on('timingInfo', self.trigger.bind(self, 'audioTimingInfo'));
            pipeline.audioSegmentStream.on('segmentTimingInfo', self.trigger.bind(self, 'audioSegmentTimingInfo')); // Set up the final part of the audio pipeline

            pipeline.adtsStream.pipe(pipeline.audioSegmentStream).pipe(pipeline.coalesceStream);
          } // emit pmt info


          self.trigger('trackinfo', {
            hasAudio: !!audioTrack,
            hasVideo: !!videoTrack
          });
        }
      }); // Re-emit any data coming from the coalesce stream to the outside world

      pipeline.coalesceStream.on('data', this.trigger.bind(this, 'data'));
      pipeline.coalesceStream.on('id3Frame', function (id3Frame) {
        id3Frame.dispatchType = pipeline.metadataStream.dispatchType;
        self.trigger('id3Frame', id3Frame);
      });
      pipeline.coalesceStream.on('caption', this.trigger.bind(this, 'caption')); // Let the consumer know we have finished flushing the entire pipeline

      pipeline.coalesceStream.on('done', this.trigger.bind(this, 'done'));
      addPipelineLogRetriggers(this, pipeline);
    }; // hook up the segment streams once track metadata is delivered


    this.setBaseMediaDecodeTime = function (baseMediaDecodeTime) {
      var pipeline = this.transmuxPipeline_;

      if (!options.keepOriginalTimestamps) {
        this.baseMediaDecodeTime = baseMediaDecodeTime;
      }

      if (audioTrack) {
        audioTrack.timelineStartInfo.dts = undefined;
        audioTrack.timelineStartInfo.pts = undefined;
        trackDecodeInfo.clearDtsInfo(audioTrack);

        if (pipeline.audioTimestampRolloverStream) {
          pipeline.audioTimestampRolloverStream.discontinuity();
        }
      }

      if (videoTrack) {
        if (pipeline.videoSegmentStream) {
          pipeline.videoSegmentStream.gopCache_ = [];
        }

        videoTrack.timelineStartInfo.dts = undefined;
        videoTrack.timelineStartInfo.pts = undefined;
        trackDecodeInfo.clearDtsInfo(videoTrack);
        pipeline.captionStream.reset();
      }

      if (pipeline.timestampRolloverStream) {
        pipeline.timestampRolloverStream.discontinuity();
      }
    };

    this.setAudioAppendStart = function (timestamp) {
      if (audioTrack) {
        this.transmuxPipeline_.audioSegmentStream.setAudioAppendStart(timestamp);
      }
    };

    this.setRemux = function (val) {
      var pipeline = this.transmuxPipeline_;
      options.remux = val;

      if (pipeline && pipeline.coalesceStream) {
        pipeline.coalesceStream.setRemux(val);
      }
    };

    this.alignGopsWith = function (gopsToAlignWith) {
      if (videoTrack && this.transmuxPipeline_.videoSegmentStream) {
        this.transmuxPipeline_.videoSegmentStream.alignGopsWith(gopsToAlignWith);
      }
    };

    this.getLogTrigger_ = function (key) {
      var self = this;
      return function (event) {
        event.stream = key;
        self.trigger('log', event);
      };
    }; // feed incoming data to the front of the parsing pipeline


    this.push = function (data) {
      if (hasFlushed) {
        var isAac = isLikelyAacData(data);

        if (isAac && this.transmuxPipeline_.type !== 'aac') {
          this.setupAacPipeline();
        } else if (!isAac && this.transmuxPipeline_.type !== 'ts') {
          this.setupTsPipeline();
        }

        hasFlushed = false;
      }

      this.transmuxPipeline_.headOfPipeline.push(data);
    }; // flush any buffered data


    this.flush = function () {
      hasFlushed = true; // Start at the top of the pipeline and flush all pending work

      this.transmuxPipeline_.headOfPipeline.flush();
    };

    this.endTimeline = function () {
      this.transmuxPipeline_.headOfPipeline.endTimeline();
    };

    this.reset = function () {
      if (this.transmuxPipeline_.headOfPipeline) {
        this.transmuxPipeline_.headOfPipeline.reset();
      }
    }; // Caption data has to be reset when seeking outside buffered range


    this.resetCaptions = function () {
      if (this.transmuxPipeline_.captionStream) {
        this.transmuxPipeline_.captionStream.reset();
      }
    };
  };

  Transmuxer.prototype = new Stream();
  var transmuxer = {
    Transmuxer: Transmuxer,
    VideoSegmentStream: VideoSegmentStream,
    AudioSegmentStream: AudioSegmentStream,
    AUDIO_PROPERTIES: AUDIO_PROPERTIES,
    VIDEO_PROPERTIES: VIDEO_PROPERTIES,
    // exported for testing
    generateSegmentTimingInfo: generateSegmentTimingInfo
  };
  /**
   * mux.js
   *
   * Copyright (c) Brightcove
   * Licensed Apache-2.0 https://github.com/videojs/mux.js/blob/master/LICENSE
   */

  var toUnsigned$3 = function (value) {
    return value >>> 0;
  };

  var toHexString$1 = function (value) {
    return ('00' + value.toString(16)).slice(-2);
  };

  var bin = {
    toUnsigned: toUnsigned$3,
    toHexString: toHexString$1
  };

  var parseType$3 = function (buffer) {
    var result = '';
    result += String.fromCharCode(buffer[0]);
    result += String.fromCharCode(buffer[1]);
    result += String.fromCharCode(buffer[2]);
    result += String.fromCharCode(buffer[3]);
    return result;
  };

  var parseType_1 = parseType$3;
  var toUnsigned$2 = bin.toUnsigned;
  var parseType$2 = parseType_1;

  var findBox$2 = function (data, path) {
    var results = [],
        i,
        size,
        type,
        end,
        subresults;

    if (!path.length) {
      // short-circuit the search for empty paths
      return null;
    }

    for (i = 0; i < data.byteLength;) {
      size = toUnsigned$2(data[i] << 24 | data[i + 1] << 16 | data[i + 2] << 8 | data[i + 3]);
      type = parseType$2(data.subarray(i + 4, i + 8));
      end = size > 1 ? i + size : data.byteLength;

      if (type === path[0]) {
        if (path.length === 1) {
          // this is the end of the path and we've found the box we were
          // looking for
          results.push(data.subarray(i + 8, end));
        } else {
          // recursively search for the next box along the path
          subresults = findBox$2(data.subarray(i + 8, end), path.slice(1));

          if (subresults.length) {
            results = results.concat(subresults);
          }
        }
      }

      i = end;
    } // we've finished searching all of data


    return results;
  };

  var findBox_1 = findBox$2;
  var toUnsigned$1 = bin.toUnsigned;
  var getUint64$2 = numbers.getUint64;

  var tfdt = function (data) {
    var result = {
      version: data[0],
      flags: new Uint8Array(data.subarray(1, 4))
    };

    if (result.version === 1) {
      result.baseMediaDecodeTime = getUint64$2(data.subarray(4));
    } else {
      result.baseMediaDecodeTime = toUnsigned$1(data[4] << 24 | data[5] << 16 | data[6] << 8 | data[7]);
    }

    return result;
  };

  var parseTfdt$2 = tfdt;

  var parseSampleFlags$1 = function (flags) {
    return {
      isLeading: (flags[0] & 0x0c) >>> 2,
      dependsOn: flags[0] & 0x03,
      isDependedOn: (flags[1] & 0xc0) >>> 6,
      hasRedundancy: (flags[1] & 0x30) >>> 4,
      paddingValue: (flags[1] & 0x0e) >>> 1,
      isNonSyncSample: flags[1] & 0x01,
      degradationPriority: flags[2] << 8 | flags[3]
    };
  };

  var parseSampleFlags_1 = parseSampleFlags$1;
  var parseSampleFlags = parseSampleFlags_1;

  var trun = function (data) {
    var result = {
      version: data[0],
      flags: new Uint8Array(data.subarray(1, 4)),
      samples: []
    },
        view = new DataView(data.buffer, data.byteOffset, data.byteLength),
        // Flag interpretation
    dataOffsetPresent = result.flags[2] & 0x01,
        // compare with 2nd byte of 0x1
    firstSampleFlagsPresent = result.flags[2] & 0x04,
        // compare with 2nd byte of 0x4
    sampleDurationPresent = result.flags[1] & 0x01,
        // compare with 2nd byte of 0x100
    sampleSizePresent = result.flags[1] & 0x02,
        // compare with 2nd byte of 0x200
    sampleFlagsPresent = result.flags[1] & 0x04,
        // compare with 2nd byte of 0x400
    sampleCompositionTimeOffsetPresent = result.flags[1] & 0x08,
        // compare with 2nd byte of 0x800
    sampleCount = view.getUint32(4),
        offset = 8,
        sample;

    if (dataOffsetPresent) {
      // 32 bit signed integer
      result.dataOffset = view.getInt32(offset);
      offset += 4;
    } // Overrides the flags for the first sample only. The order of
    // optional values will be: duration, size, compositionTimeOffset


    if (firstSampleFlagsPresent && sampleCount) {
      sample = {
        flags: parseSampleFlags(data.subarray(offset, offset + 4))
      };
      offset += 4;

      if (sampleDurationPresent) {
        sample.duration = view.getUint32(offset);
        offset += 4;
      }

      if (sampleSizePresent) {
        sample.size = view.getUint32(offset);
        offset += 4;
      }

      if (sampleCompositionTimeOffsetPresent) {
        if (result.version === 1) {
          sample.compositionTimeOffset = view.getInt32(offset);
        } else {
          sample.compositionTimeOffset = view.getUint32(offset);
        }

        offset += 4;
      }

      result.samples.push(sample);
      sampleCount--;
    }

    while (sampleCount--) {
      sample = {};

      if (sampleDurationPresent) {
        sample.duration = view.getUint32(offset);
        offset += 4;
      }

      if (sampleSizePresent) {
        sample.size = view.getUint32(offset);
        offset += 4;
      }

      if (sampleFlagsPresent) {
        sample.flags = parseSampleFlags(data.subarray(offset, offset + 4));
        offset += 4;
      }

      if (sampleCompositionTimeOffsetPresent) {
        if (result.version === 1) {
          sample.compositionTimeOffset = view.getInt32(offset);
        } else {
          sample.compositionTimeOffset = view.getUint32(offset);
        }

        offset += 4;
      }

      result.samples.push(sample);
    }

    return result;
  };

  var parseTrun$2 = trun;

  var tfhd = function (data) {
    var view = new DataView(data.buffer, data.byteOffset, data.byteLength),
        result = {
      version: data[0],
      flags: new Uint8Array(data.subarray(1, 4)),
      trackId: view.getUint32(4)
    },
        baseDataOffsetPresent = result.flags[2] & 0x01,
        sampleDescriptionIndexPresent = result.flags[2] & 0x02,
        defaultSampleDurationPresent = result.flags[2] & 0x08,
        defaultSampleSizePresent = result.flags[2] & 0x10,
        defaultSampleFlagsPresent = result.flags[2] & 0x20,
        durationIsEmpty = result.flags[0] & 0x010000,
        defaultBaseIsMoof = result.flags[0] & 0x020000,
        i;
    i = 8;

    if (baseDataOffsetPresent) {
      i += 4; // truncate top 4 bytes
      // FIXME: should we read the full 64 bits?

      result.baseDataOffset = view.getUint32(12);
      i += 4;
    }

    if (sampleDescriptionIndexPresent) {
      result.sampleDescriptionIndex = view.getUint32(i);
      i += 4;
    }

    if (defaultSampleDurationPresent) {
      result.defaultSampleDuration = view.getUint32(i);
      i += 4;
    }

    if (defaultSampleSizePresent) {
      result.defaultSampleSize = view.getUint32(i);
      i += 4;
    }

    if (defaultSampleFlagsPresent) {
      result.defaultSampleFlags = view.getUint32(i);
    }

    if (durationIsEmpty) {
      result.durationIsEmpty = true;
    }

    if (!baseDataOffsetPresent && defaultBaseIsMoof) {
      result.baseDataOffsetIsMoof = true;
    }

    return result;
  };

  var parseTfhd$2 = tfhd;
  var win;

  if (typeof window !== "undefined") {
    win = window;
  } else if (typeof commonjsGlobal !== "undefined") {
    win = commonjsGlobal;
  } else if (typeof self !== "undefined") {
    win = self;
  } else {
    win = {};
  }

  var window_1 = win;
  /**
   * mux.js
   *
   * Copyright (c) Brightcove
   * Licensed Apache-2.0 https://github.com/videojs/mux.js/blob/master/LICENSE
   *
   * Reads in-band CEA-708 captions out of FMP4 segments.
   * @see https://en.wikipedia.org/wiki/CEA-708
   */

  var discardEmulationPreventionBytes = captionPacketParser.discardEmulationPreventionBytes;
  var CaptionStream = captionStream.CaptionStream;
  var findBox$1 = findBox_1;
  var parseTfdt$1 = parseTfdt$2;
  var parseTrun$1 = parseTrun$2;
  var parseTfhd$1 = parseTfhd$2;
  var window$2 = window_1;
  /**
    * Maps an offset in the mdat to a sample based on the the size of the samples.
    * Assumes that `parseSamples` has been called first.
    *
    * @param {Number} offset - The offset into the mdat
    * @param {Object[]} samples - An array of samples, parsed using `parseSamples`
    * @return {?Object} The matching sample, or null if no match was found.
    *
    * @see ISO-BMFF-12/2015, Section 8.8.8
   **/

  var mapToSample = function (offset, samples) {
    var approximateOffset = offset;

    for (var i = 0; i < samples.length; i++) {
      var sample = samples[i];

      if (approximateOffset < sample.size) {
        return sample;
      }

      approximateOffset -= sample.size;
    }

    return null;
  };
  /**
    * Finds SEI nal units contained in a Media Data Box.
    * Assumes that `parseSamples` has been called first.
    *
    * @param {Uint8Array} avcStream - The bytes of the mdat
    * @param {Object[]} samples - The samples parsed out by `parseSamples`
    * @param {Number} trackId - The trackId of this video track
    * @return {Object[]} seiNals - the parsed SEI NALUs found.
    *   The contents of the seiNal should match what is expected by
    *   CaptionStream.push (nalUnitType, size, data, escapedRBSP, pts, dts)
    *
    * @see ISO-BMFF-12/2015, Section 8.1.1
    * @see Rec. ITU-T H.264, 7.3.2.3.1
   **/


  var findSeiNals = function (avcStream, samples, trackId) {
    var avcView = new DataView(avcStream.buffer, avcStream.byteOffset, avcStream.byteLength),
        result = {
      logs: [],
      seiNals: []
    },
        seiNal,
        i,
        length,
        lastMatchedSample;

    for (i = 0; i + 4 < avcStream.length; i += length) {
      length = avcView.getUint32(i);
      i += 4; // Bail if this doesn't appear to be an H264 stream

      if (length <= 0) {
        continue;
      }

      switch (avcStream[i] & 0x1F) {
        case 0x06:
          var data = avcStream.subarray(i + 1, i + 1 + length);
          var matchingSample = mapToSample(i, samples);
          seiNal = {
            nalUnitType: 'sei_rbsp',
            size: length,
            data: data,
            escapedRBSP: discardEmulationPreventionBytes(data),
            trackId: trackId
          };

          if (matchingSample) {
            seiNal.pts = matchingSample.pts;
            seiNal.dts = matchingSample.dts;
            lastMatchedSample = matchingSample;
          } else if (lastMatchedSample) {
            // If a matching sample cannot be found, use the last
            // sample's values as they should be as close as possible
            seiNal.pts = lastMatchedSample.pts;
            seiNal.dts = lastMatchedSample.dts;
          } else {
            result.logs.push({
              level: 'warn',
              message: 'We\'ve encountered a nal unit without data at ' + i + ' for trackId ' + trackId + '. See mux.js#223.'
            });
            break;
          }

          result.seiNals.push(seiNal);
          break;
      }
    }

    return result;
  };
  /**
    * Parses sample information out of Track Run Boxes and calculates
    * the absolute presentation and decode timestamps of each sample.
    *
    * @param {Array<Uint8Array>} truns - The Trun Run boxes to be parsed
    * @param {Number|BigInt} baseMediaDecodeTime - base media decode time from tfdt
        @see ISO-BMFF-12/2015, Section 8.8.12
    * @param {Object} tfhd - The parsed Track Fragment Header
    *   @see inspect.parseTfhd
    * @return {Object[]} the parsed samples
    *
    * @see ISO-BMFF-12/2015, Section 8.8.8
   **/


  var parseSamples = function (truns, baseMediaDecodeTime, tfhd) {
    var currentDts = baseMediaDecodeTime;
    var defaultSampleDuration = tfhd.defaultSampleDuration || 0;
    var defaultSampleSize = tfhd.defaultSampleSize || 0;
    var trackId = tfhd.trackId;
    var allSamples = [];
    truns.forEach(function (trun) {
      // Note: We currently do not parse the sample table as well
      // as the trun. It's possible some sources will require this.
      // moov > trak > mdia > minf > stbl
      var trackRun = parseTrun$1(trun);
      var samples = trackRun.samples;
      samples.forEach(function (sample) {
        if (sample.duration === undefined) {
          sample.duration = defaultSampleDuration;
        }

        if (sample.size === undefined) {
          sample.size = defaultSampleSize;
        }

        sample.trackId = trackId;
        sample.dts = currentDts;

        if (sample.compositionTimeOffset === undefined) {
          sample.compositionTimeOffset = 0;
        }

        if (typeof currentDts === 'bigint') {
          sample.pts = currentDts + window$2.BigInt(sample.compositionTimeOffset);
          currentDts += window$2.BigInt(sample.duration);
        } else {
          sample.pts = currentDts + sample.compositionTimeOffset;
          currentDts += sample.duration;
        }
      });
      allSamples = allSamples.concat(samples);
    });
    return allSamples;
  };
  /**
    * Parses out caption nals from an FMP4 segment's video tracks.
    *
    * @param {Uint8Array} segment - The bytes of a single segment
    * @param {Number} videoTrackId - The trackId of a video track in the segment
    * @return {Object.<Number, Object[]>} A mapping of video trackId to
    *   a list of seiNals found in that track
   **/


  var parseCaptionNals = function (segment, videoTrackId) {
    // To get the samples
    var trafs = findBox$1(segment, ['moof', 'traf']); // To get SEI NAL units

    var mdats = findBox$1(segment, ['mdat']);
    var captionNals = {};
    var mdatTrafPairs = []; // Pair up each traf with a mdat as moofs and mdats are in pairs

    mdats.forEach(function (mdat, index) {
      var matchingTraf = trafs[index];
      mdatTrafPairs.push({
        mdat: mdat,
        traf: matchingTraf
      });
    });
    mdatTrafPairs.forEach(function (pair) {
      var mdat = pair.mdat;
      var traf = pair.traf;
      var tfhd = findBox$1(traf, ['tfhd']); // Exactly 1 tfhd per traf

      var headerInfo = parseTfhd$1(tfhd[0]);
      var trackId = headerInfo.trackId;
      var tfdt = findBox$1(traf, ['tfdt']); // Either 0 or 1 tfdt per traf

      var baseMediaDecodeTime = tfdt.length > 0 ? parseTfdt$1(tfdt[0]).baseMediaDecodeTime : 0;
      var truns = findBox$1(traf, ['trun']);
      var samples;
      var result; // Only parse video data for the chosen video track

      if (videoTrackId === trackId && truns.length > 0) {
        samples = parseSamples(truns, baseMediaDecodeTime, headerInfo);
        result = findSeiNals(mdat, samples, trackId);

        if (!captionNals[trackId]) {
          captionNals[trackId] = {
            seiNals: [],
            logs: []
          };
        }

        captionNals[trackId].seiNals = captionNals[trackId].seiNals.concat(result.seiNals);
        captionNals[trackId].logs = captionNals[trackId].logs.concat(result.logs);
      }
    });
    return captionNals;
  };
  /**
    * Parses out inband captions from an MP4 container and returns
    * caption objects that can be used by WebVTT and the TextTrack API.
    * @see https://developer.mozilla.org/en-US/docs/Web/API/VTTCue
    * @see https://developer.mozilla.org/en-US/docs/Web/API/TextTrack
    * Assumes that `probe.getVideoTrackIds` and `probe.timescale` have been called first
    *
    * @param {Uint8Array} segment - The fmp4 segment containing embedded captions
    * @param {Number} trackId - The id of the video track to parse
    * @param {Number} timescale - The timescale for the video track from the init segment
    *
    * @return {?Object[]} parsedCaptions - A list of captions or null if no video tracks
    * @return {Number} parsedCaptions[].startTime - The time to show the caption in seconds
    * @return {Number} parsedCaptions[].endTime - The time to stop showing the caption in seconds
    * @return {Object[]} parsedCaptions[].content - A list of individual caption segments
    * @return {String} parsedCaptions[].content.text - The visible content of the caption segment
    * @return {Number} parsedCaptions[].content.line - The line height from 1-15 for positioning of the caption segment
    * @return {Number} parsedCaptions[].content.position - The column indent percentage for cue positioning from 10-80
   **/


  var parseEmbeddedCaptions = function (segment, trackId, timescale) {
    var captionNals; // the ISO-BMFF spec says that trackId can't be zero, but there's some broken content out there

    if (trackId === null) {
      return null;
    }

    captionNals = parseCaptionNals(segment, trackId);
    var trackNals = captionNals[trackId] || {};
    return {
      seiNals: trackNals.seiNals,
      logs: trackNals.logs,
      timescale: timescale
    };
  };
  /**
    * Converts SEI NALUs into captions that can be used by video.js
   **/


  var CaptionParser = function () {
    var isInitialized = false;
    var captionStream; // Stores segments seen before trackId and timescale are set

    var segmentCache; // Stores video track ID of the track being parsed

    var trackId; // Stores the timescale of the track being parsed

    var timescale; // Stores captions parsed so far

    var parsedCaptions; // Stores whether we are receiving partial data or not

    var parsingPartial;
    /**
      * A method to indicate whether a CaptionParser has been initalized
      * @returns {Boolean}
     **/

    this.isInitialized = function () {
      return isInitialized;
    };
    /**
      * Initializes the underlying CaptionStream, SEI NAL parsing
      * and management, and caption collection
     **/


    this.init = function (options) {
      captionStream = new CaptionStream();
      isInitialized = true;
      parsingPartial = options ? options.isPartial : false; // Collect dispatched captions

      captionStream.on('data', function (event) {
        // Convert to seconds in the source's timescale
        event.startTime = event.startPts / timescale;
        event.endTime = event.endPts / timescale;
        parsedCaptions.captions.push(event);
        parsedCaptions.captionStreams[event.stream] = true;
      });
      captionStream.on('log', function (log) {
        parsedCaptions.logs.push(log);
      });
    };
    /**
      * Determines if a new video track will be selected
      * or if the timescale changed
      * @return {Boolean}
     **/


    this.isNewInit = function (videoTrackIds, timescales) {
      if (videoTrackIds && videoTrackIds.length === 0 || timescales && typeof timescales === 'object' && Object.keys(timescales).length === 0) {
        return false;
      }

      return trackId !== videoTrackIds[0] || timescale !== timescales[trackId];
    };
    /**
      * Parses out SEI captions and interacts with underlying
      * CaptionStream to return dispatched captions
      *
      * @param {Uint8Array} segment - The fmp4 segment containing embedded captions
      * @param {Number[]} videoTrackIds - A list of video tracks found in the init segment
      * @param {Object.<Number, Number>} timescales - The timescales found in the init segment
      * @see parseEmbeddedCaptions
      * @see m2ts/caption-stream.js
     **/


    this.parse = function (segment, videoTrackIds, timescales) {
      var parsedData;

      if (!this.isInitialized()) {
        return null; // This is not likely to be a video segment
      } else if (!videoTrackIds || !timescales) {
        return null;
      } else if (this.isNewInit(videoTrackIds, timescales)) {
        // Use the first video track only as there is no
        // mechanism to switch to other video tracks
        trackId = videoTrackIds[0];
        timescale = timescales[trackId]; // If an init segment has not been seen yet, hold onto segment
        // data until we have one.
        // the ISO-BMFF spec says that trackId can't be zero, but there's some broken content out there
      } else if (trackId === null || !timescale) {
        segmentCache.push(segment);
        return null;
      } // Now that a timescale and trackId is set, parse cached segments


      while (segmentCache.length > 0) {
        var cachedSegment = segmentCache.shift();
        this.parse(cachedSegment, videoTrackIds, timescales);
      }

      parsedData = parseEmbeddedCaptions(segment, trackId, timescale);

      if (parsedData && parsedData.logs) {
        parsedCaptions.logs = parsedCaptions.logs.concat(parsedData.logs);
      }

      if (parsedData === null || !parsedData.seiNals) {
        if (parsedCaptions.logs.length) {
          return {
            logs: parsedCaptions.logs,
            captions: [],
            captionStreams: []
          };
        }

        return null;
      }

      this.pushNals(parsedData.seiNals); // Force the parsed captions to be dispatched

      this.flushStream();
      return parsedCaptions;
    };
    /**
      * Pushes SEI NALUs onto CaptionStream
      * @param {Object[]} nals - A list of SEI nals parsed using `parseCaptionNals`
      * Assumes that `parseCaptionNals` has been called first
      * @see m2ts/caption-stream.js
      **/


    this.pushNals = function (nals) {
      if (!this.isInitialized() || !nals || nals.length === 0) {
        return null;
      }

      nals.forEach(function (nal) {
        captionStream.push(nal);
      });
    };
    /**
      * Flushes underlying CaptionStream to dispatch processed, displayable captions
      * @see m2ts/caption-stream.js
     **/


    this.flushStream = function () {
      if (!this.isInitialized()) {
        return null;
      }

      if (!parsingPartial) {
        captionStream.flush();
      } else {
        captionStream.partialFlush();
      }
    };
    /**
      * Reset caption buckets for new data
     **/


    this.clearParsedCaptions = function () {
      parsedCaptions.captions = [];
      parsedCaptions.captionStreams = {};
      parsedCaptions.logs = [];
    };
    /**
      * Resets underlying CaptionStream
      * @see m2ts/caption-stream.js
     **/


    this.resetCaptionStream = function () {
      if (!this.isInitialized()) {
        return null;
      }

      captionStream.reset();
    };
    /**
      * Convenience method to clear all captions flushed from the
      * CaptionStream and still being parsed
      * @see m2ts/caption-stream.js
     **/


    this.clearAllCaptions = function () {
      this.clearParsedCaptions();
      this.resetCaptionStream();
    };
    /**
      * Reset caption parser
     **/


    this.reset = function () {
      segmentCache = [];
      trackId = null;
      timescale = null;

      if (!parsedCaptions) {
        parsedCaptions = {
          captions: [],
          // CC1, CC2, CC3, CC4
          captionStreams: {},
          logs: []
        };
      } else {
        this.clearParsedCaptions();
      }

      this.resetCaptionStream();
    };

    this.reset();
  };

  var captionParser = CaptionParser;
  /**
   * Returns the first string in the data array ending with a null char '\0'
   * @param {UInt8} data
   * @returns the string with the null char
   */

  var uint8ToCString$1 = function (data) {
    var index = 0;
    var curChar = String.fromCharCode(data[index]);
    var retString = '';

    while (curChar !== '\0') {
      retString += curChar;
      index++;
      curChar = String.fromCharCode(data[index]);
    } // Add nullChar


    retString += curChar;
    return retString;
  };

  var string = {
    uint8ToCString: uint8ToCString$1
  };
  var uint8ToCString = string.uint8ToCString;
  var getUint64$1 = numbers.getUint64;
  /**
   * Based on: ISO/IEC 23009 Section: 5.10.3.3
   * References:
   * https://dashif-documents.azurewebsites.net/Events/master/event.html#emsg-format
   * https://aomediacodec.github.io/id3-emsg/
   *
   * Takes emsg box data as a uint8 array and returns a emsg box object
   * @param {UInt8Array} boxData data from emsg box
   * @returns A parsed emsg box object
   */

  var parseEmsgBox = function (boxData) {
    // version + flags
    var offset = 4;
    var version = boxData[0];
    var scheme_id_uri, value, timescale, presentation_time, presentation_time_delta, event_duration, id, message_data;

    if (version === 0) {
      scheme_id_uri = uint8ToCString(boxData.subarray(offset));
      offset += scheme_id_uri.length;
      value = uint8ToCString(boxData.subarray(offset));
      offset += value.length;
      var dv = new DataView(boxData.buffer);
      timescale = dv.getUint32(offset);
      offset += 4;
      presentation_time_delta = dv.getUint32(offset);
      offset += 4;
      event_duration = dv.getUint32(offset);
      offset += 4;
      id = dv.getUint32(offset);
      offset += 4;
    } else if (version === 1) {
      var dv = new DataView(boxData.buffer);
      timescale = dv.getUint32(offset);
      offset += 4;
      presentation_time = getUint64$1(boxData.subarray(offset));
      offset += 8;
      event_duration = dv.getUint32(offset);
      offset += 4;
      id = dv.getUint32(offset);
      offset += 4;
      scheme_id_uri = uint8ToCString(boxData.subarray(offset));
      offset += scheme_id_uri.length;
      value = uint8ToCString(boxData.subarray(offset));
      offset += value.length;
    }

    message_data = new Uint8Array(boxData.subarray(offset, boxData.byteLength));
    var emsgBox = {
      scheme_id_uri,
      value,
      // if timescale is undefined or 0 set to 1
      timescale: timescale ? timescale : 1,
      presentation_time,
      presentation_time_delta,
      event_duration,
      id,
      message_data
    };
    return isValidEmsgBox(version, emsgBox) ? emsgBox : undefined;
  };
  /**
   * Scales a presentation time or time delta with an offset with a provided timescale
   * @param {number} presentationTime
   * @param {number} timescale
   * @param {number} timeDelta
   * @param {number} offset
   * @returns the scaled time as a number
   */


  var scaleTime = function (presentationTime, timescale, timeDelta, offset) {
    return presentationTime || presentationTime === 0 ? presentationTime / timescale : offset + timeDelta / timescale;
  };
  /**
   * Checks the emsg box data for validity based on the version
   * @param {number} version of the emsg box to validate
   * @param {Object} emsg the emsg data to validate
   * @returns if the box is valid as a boolean
   */


  var isValidEmsgBox = function (version, emsg) {
    var hasScheme = emsg.scheme_id_uri !== '\0';
    var isValidV0Box = version === 0 && isDefined(emsg.presentation_time_delta) && hasScheme;
    var isValidV1Box = version === 1 && isDefined(emsg.presentation_time) && hasScheme; // Only valid versions of emsg are 0 and 1

    return !(version > 1) && isValidV0Box || isValidV1Box;
  }; // Utility function to check if an object is defined


  var isDefined = function (data) {
    return data !== undefined || data !== null;
  };

  var emsg$1 = {
    parseEmsgBox: parseEmsgBox,
    scaleTime: scaleTime
  };
  /**
   * mux.js
   *
   * Copyright (c) Brightcove
   * Licensed Apache-2.0 https://github.com/videojs/mux.js/blob/master/LICENSE
   *
   * Utilities to detect basic properties and metadata about MP4s.
   */

  var toUnsigned = bin.toUnsigned;
  var toHexString = bin.toHexString;
  var findBox = findBox_1;
  var parseType$1 = parseType_1;
  var emsg = emsg$1;
  var parseTfhd = parseTfhd$2;
  var parseTrun = parseTrun$2;
  var parseTfdt = parseTfdt$2;
  var getUint64 = numbers.getUint64;
  var timescale, startTime, compositionStartTime, getVideoTrackIds, getTracks, getTimescaleFromMediaHeader, getEmsgID3;
  var window$1 = window_1;
  var parseId3Frames = parseId3.parseId3Frames;
  /**
   * Parses an MP4 initialization segment and extracts the timescale
   * values for any declared tracks. Timescale values indicate the
   * number of clock ticks per second to assume for time-based values
   * elsewhere in the MP4.
   *
   * To determine the start time of an MP4, you need two pieces of
   * information: the timescale unit and the earliest base media decode
   * time. Multiple timescales can be specified within an MP4 but the
   * base media decode time is always expressed in the timescale from
   * the media header box for the track:
   * ```
   * moov > trak > mdia > mdhd.timescale
   * ```
   * @param init {Uint8Array} the bytes of the init segment
   * @return {object} a hash of track ids to timescale values or null if
   * the init segment is malformed.
   */

  timescale = function (init) {
    var result = {},
        traks = findBox(init, ['moov', 'trak']); // mdhd timescale

    return traks.reduce(function (result, trak) {
      var tkhd, version, index, id, mdhd;
      tkhd = findBox(trak, ['tkhd'])[0];

      if (!tkhd) {
        return null;
      }

      version = tkhd[0];
      index = version === 0 ? 12 : 20;
      id = toUnsigned(tkhd[index] << 24 | tkhd[index + 1] << 16 | tkhd[index + 2] << 8 | tkhd[index + 3]);
      mdhd = findBox(trak, ['mdia', 'mdhd'])[0];

      if (!mdhd) {
        return null;
      }

      version = mdhd[0];
      index = version === 0 ? 12 : 20;
      result[id] = toUnsigned(mdhd[index] << 24 | mdhd[index + 1] << 16 | mdhd[index + 2] << 8 | mdhd[index + 3]);
      return result;
    }, result);
  };
  /**
   * Determine the base media decode start time, in seconds, for an MP4
   * fragment. If multiple fragments are specified, the earliest time is
   * returned.
   *
   * The base media decode time can be parsed from track fragment
   * metadata:
   * ```
   * moof > traf > tfdt.baseMediaDecodeTime
   * ```
   * It requires the timescale value from the mdhd to interpret.
   *
   * @param timescale {object} a hash of track ids to timescale values.
   * @return {number} the earliest base media decode start time for the
   * fragment, in seconds
   */


  startTime = function (timescale, fragment) {
    var trafs; // we need info from two childrend of each track fragment box

    trafs = findBox(fragment, ['moof', 'traf']); // determine the start times for each track

    var lowestTime = trafs.reduce(function (acc, traf) {
      var tfhd = findBox(traf, ['tfhd'])[0]; // get the track id from the tfhd

      var id = toUnsigned(tfhd[4] << 24 | tfhd[5] << 16 | tfhd[6] << 8 | tfhd[7]); // assume a 90kHz clock if no timescale was specified

      var scale = timescale[id] || 90e3; // get the base media decode time from the tfdt

      var tfdt = findBox(traf, ['tfdt'])[0];
      var dv = new DataView(tfdt.buffer, tfdt.byteOffset, tfdt.byteLength);
      var baseTime; // version 1 is 64 bit

      if (tfdt[0] === 1) {
        baseTime = getUint64(tfdt.subarray(4, 12));
      } else {
        baseTime = dv.getUint32(4);
      } // convert base time to seconds if it is a valid number.


      let seconds;

      if (typeof baseTime === 'bigint') {
        seconds = baseTime / window$1.BigInt(scale);
      } else if (typeof baseTime === 'number' && !isNaN(baseTime)) {
        seconds = baseTime / scale;
      }

      if (seconds < Number.MAX_SAFE_INTEGER) {
        seconds = Number(seconds);
      }

      if (seconds < acc) {
        acc = seconds;
      }

      return acc;
    }, Infinity);
    return typeof lowestTime === 'bigint' || isFinite(lowestTime) ? lowestTime : 0;
  };
  /**
   * Determine the composition start, in seconds, for an MP4
   * fragment.
   *
   * The composition start time of a fragment can be calculated using the base
   * media decode time, composition time offset, and timescale, as follows:
   *
   * compositionStartTime = (baseMediaDecodeTime + compositionTimeOffset) / timescale
   *
   * All of the aforementioned information is contained within a media fragment's
   * `traf` box, except for timescale info, which comes from the initialization
   * segment, so a track id (also contained within a `traf`) is also necessary to
   * associate it with a timescale
   *
   *
   * @param timescales {object} - a hash of track ids to timescale values.
   * @param fragment {Unit8Array} - the bytes of a media segment
   * @return {number} the composition start time for the fragment, in seconds
   **/


  compositionStartTime = function (timescales, fragment) {
    var trafBoxes = findBox(fragment, ['moof', 'traf']);
    var baseMediaDecodeTime = 0;
    var compositionTimeOffset = 0;
    var trackId;

    if (trafBoxes && trafBoxes.length) {
      // The spec states that track run samples contained within a `traf` box are contiguous, but
      // it does not explicitly state whether the `traf` boxes themselves are contiguous.
      // We will assume that they are, so we only need the first to calculate start time.
      var tfhd = findBox(trafBoxes[0], ['tfhd'])[0];
      var trun = findBox(trafBoxes[0], ['trun'])[0];
      var tfdt = findBox(trafBoxes[0], ['tfdt'])[0];

      if (tfhd) {
        var parsedTfhd = parseTfhd(tfhd);
        trackId = parsedTfhd.trackId;
      }

      if (tfdt) {
        var parsedTfdt = parseTfdt(tfdt);
        baseMediaDecodeTime = parsedTfdt.baseMediaDecodeTime;
      }

      if (trun) {
        var parsedTrun = parseTrun(trun);

        if (parsedTrun.samples && parsedTrun.samples.length) {
          compositionTimeOffset = parsedTrun.samples[0].compositionTimeOffset || 0;
        }
      }
    } // Get timescale for this specific track. Assume a 90kHz clock if no timescale was
    // specified.


    var timescale = timescales[trackId] || 90e3; // return the composition start time, in seconds

    if (typeof baseMediaDecodeTime === 'bigint') {
      compositionTimeOffset = window$1.BigInt(compositionTimeOffset);
      timescale = window$1.BigInt(timescale);
    }

    var result = (baseMediaDecodeTime + compositionTimeOffset) / timescale;

    if (typeof result === 'bigint' && result < Number.MAX_SAFE_INTEGER) {
      result = Number(result);
    }

    return result;
  };
  /**
    * Find the trackIds of the video tracks in this source.
    * Found by parsing the Handler Reference and Track Header Boxes:
    *   moov > trak > mdia > hdlr
    *   moov > trak > tkhd
    *
    * @param {Uint8Array} init - The bytes of the init segment for this source
    * @return {Number[]} A list of trackIds
    *
    * @see ISO-BMFF-12/2015, Section 8.4.3
   **/


  getVideoTrackIds = function (init) {
    var traks = findBox(init, ['moov', 'trak']);
    var videoTrackIds = [];
    traks.forEach(function (trak) {
      var hdlrs = findBox(trak, ['mdia', 'hdlr']);
      var tkhds = findBox(trak, ['tkhd']);
      hdlrs.forEach(function (hdlr, index) {
        var handlerType = parseType$1(hdlr.subarray(8, 12));
        var tkhd = tkhds[index];
        var view;
        var version;
        var trackId;

        if (handlerType === 'vide') {
          view = new DataView(tkhd.buffer, tkhd.byteOffset, tkhd.byteLength);
          version = view.getUint8(0);
          trackId = version === 0 ? view.getUint32(12) : view.getUint32(20);
          videoTrackIds.push(trackId);
        }
      });
    });
    return videoTrackIds;
  };

  getTimescaleFromMediaHeader = function (mdhd) {
    // mdhd is a FullBox, meaning it will have its own version as the first byte
    var version = mdhd[0];
    var index = version === 0 ? 12 : 20;
    return toUnsigned(mdhd[index] << 24 | mdhd[index + 1] << 16 | mdhd[index + 2] << 8 | mdhd[index + 3]);
  };
  /**
   * Get all the video, audio, and hint tracks from a non fragmented
   * mp4 segment
   */


  getTracks = function (init) {
    var traks = findBox(init, ['moov', 'trak']);
    var tracks = [];
    traks.forEach(function (trak) {
      var track = {};
      var tkhd = findBox(trak, ['tkhd'])[0];
      var view, tkhdVersion; // id

      if (tkhd) {
        view = new DataView(tkhd.buffer, tkhd.byteOffset, tkhd.byteLength);
        tkhdVersion = view.getUint8(0);
        track.id = tkhdVersion === 0 ? view.getUint32(12) : view.getUint32(20);
      }

      var hdlr = findBox(trak, ['mdia', 'hdlr'])[0]; // type

      if (hdlr) {
        var type = parseType$1(hdlr.subarray(8, 12));

        if (type === 'vide') {
          track.type = 'video';
        } else if (type === 'soun') {
          track.type = 'audio';
        } else {
          track.type = type;
        }
      } // codec


      var stsd = findBox(trak, ['mdia', 'minf', 'stbl', 'stsd'])[0];

      if (stsd) {
        var sampleDescriptions = stsd.subarray(8); // gives the codec type string

        track.codec = parseType$1(sampleDescriptions.subarray(4, 8));
        var codecBox = findBox(sampleDescriptions, [track.codec])[0];
        var codecConfig, codecConfigType;

        if (codecBox) {
          // https://tools.ietf.org/html/rfc6381#section-3.3
          if (/^[asm]vc[1-9]$/i.test(track.codec)) {
            // we don't need anything but the "config" parameter of the
            // avc1 codecBox
            codecConfig = codecBox.subarray(78);
            codecConfigType = parseType$1(codecConfig.subarray(4, 8));

            if (codecConfigType === 'avcC' && codecConfig.length > 11) {
              track.codec += '.'; // left padded with zeroes for single digit hex
              // profile idc

              track.codec += toHexString(codecConfig[9]); // the byte containing the constraint_set flags

              track.codec += toHexString(codecConfig[10]); // level idc

              track.codec += toHexString(codecConfig[11]);
            } else {
              // TODO: show a warning that we couldn't parse the codec
              // and are using the default
              track.codec = 'avc1.4d400d';
            }
          } else if (/^mp4[a,v]$/i.test(track.codec)) {
            // we do not need anything but the streamDescriptor of the mp4a codecBox
            codecConfig = codecBox.subarray(28);
            codecConfigType = parseType$1(codecConfig.subarray(4, 8));

            if (codecConfigType === 'esds' && codecConfig.length > 20 && codecConfig[19] !== 0) {
              track.codec += '.' + toHexString(codecConfig[19]); // this value is only a single digit

              track.codec += '.' + toHexString(codecConfig[20] >>> 2 & 0x3f).replace(/^0/, '');
            } else {
              // TODO: show a warning that we couldn't parse the codec
              // and are using the default
              track.codec = 'mp4a.40.2';
            }
          } else {
            // flac, opus, etc
            track.codec = track.codec.toLowerCase();
          }
        }
      }

      var mdhd = findBox(trak, ['mdia', 'mdhd'])[0];

      if (mdhd) {
        track.timescale = getTimescaleFromMediaHeader(mdhd);
      }

      tracks.push(track);
    });
    return tracks;
  };
  /**
   * Returns an array of emsg ID3 data from the provided segmentData.
   * An offset can also be provided as the Latest Arrival Time to calculate
   * the Event Start Time of v0 EMSG boxes.
   * See: https://dashif-documents.azurewebsites.net/Events/master/event.html#Inband-event-timing
   *
   * @param {Uint8Array} segmentData the segment byte array.
   * @param {number} offset the segment start time or Latest Arrival Time,
   * @return {Object[]} an array of ID3 parsed from EMSG boxes
   */


  getEmsgID3 = function (segmentData, offset = 0) {
    var emsgBoxes = findBox(segmentData, ['emsg']);
    return emsgBoxes.map(data => {
      var parsedBox = emsg.parseEmsgBox(new Uint8Array(data));
      var parsedId3Frames = parseId3Frames(parsedBox.message_data);
      return {
        cueTime: emsg.scaleTime(parsedBox.presentation_time, parsedBox.timescale, parsedBox.presentation_time_delta, offset),
        duration: emsg.scaleTime(parsedBox.event_duration, parsedBox.timescale),
        frames: parsedId3Frames
      };
    });
  };

  var probe$2 = {
    // export mp4 inspector's findBox and parseType for backwards compatibility
    findBox: findBox,
    parseType: parseType$1,
    timescale: timescale,
    startTime: startTime,
    compositionStartTime: compositionStartTime,
    videoTrackIds: getVideoTrackIds,
    tracks: getTracks,
    getTimescaleFromMediaHeader: getTimescaleFromMediaHeader,
    getEmsgID3: getEmsgID3
  };
  /**
   * mux.js
   *
   * Copyright (c) Brightcove
   * Licensed Apache-2.0 https://github.com/videojs/mux.js/blob/master/LICENSE
   *
   * Utilities to detect basic properties and metadata about TS Segments.
   */

  var StreamTypes$1 = streamTypes;

  var parsePid = function (packet) {
    var pid = packet[1] & 0x1f;
    pid <<= 8;
    pid |= packet[2];
    return pid;
  };

  var parsePayloadUnitStartIndicator = function (packet) {
    return !!(packet[1] & 0x40);
  };

  var parseAdaptionField = function (packet) {
    var offset = 0; // if an adaption field is present, its length is specified by the
    // fifth byte of the TS packet header. The adaptation field is
    // used to add stuffing to PES packets that don't fill a complete
    // TS packet, and to specify some forms of timing and control data
    // that we do not currently use.

    if ((packet[3] & 0x30) >>> 4 > 0x01) {
      offset += packet[4] + 1;
    }

    return offset;
  };

  var parseType = function (packet, pmtPid) {
    var pid = parsePid(packet);

    if (pid === 0) {
      return 'pat';
    } else if (pid === pmtPid) {
      return 'pmt';
    } else if (pmtPid) {
      return 'pes';
    }

    return null;
  };

  var parsePat = function (packet) {
    var pusi = parsePayloadUnitStartIndicator(packet);
    var offset = 4 + parseAdaptionField(packet);

    if (pusi) {
      offset += packet[offset] + 1;
    }

    return (packet[offset + 10] & 0x1f) << 8 | packet[offset + 11];
  };

  var parsePmt = function (packet) {
    var programMapTable = {};
    var pusi = parsePayloadUnitStartIndicator(packet);
    var payloadOffset = 4 + parseAdaptionField(packet);

    if (pusi) {
      payloadOffset += packet[payloadOffset] + 1;
    } // PMTs can be sent ahead of the time when they should actually
    // take effect. We don't believe this should ever be the case
    // for HLS but we'll ignore "forward" PMT declarations if we see
    // them. Future PMT declarations have the current_next_indicator
    // set to zero.


    if (!(packet[payloadOffset + 5] & 0x01)) {
      return;
    }

    var sectionLength, tableEnd, programInfoLength; // the mapping table ends at the end of the current section

    sectionLength = (packet[payloadOffset + 1] & 0x0f) << 8 | packet[payloadOffset + 2];
    tableEnd = 3 + sectionLength - 4; // to determine where the table is, we have to figure out how
    // long the program info descriptors are

    programInfoLength = (packet[payloadOffset + 10] & 0x0f) << 8 | packet[payloadOffset + 11]; // advance the offset to the first entry in the mapping table

    var offset = 12 + programInfoLength;

    while (offset < tableEnd) {
      var i = payloadOffset + offset; // add an entry that maps the elementary_pid to the stream_type

      programMapTable[(packet[i + 1] & 0x1F) << 8 | packet[i + 2]] = packet[i]; // move to the next table entry
      // skip past the elementary stream descriptors, if present

      offset += ((packet[i + 3] & 0x0F) << 8 | packet[i + 4]) + 5;
    }

    return programMapTable;
  };

  var parsePesType = function (packet, programMapTable) {
    var pid = parsePid(packet);
    var type = programMapTable[pid];

    switch (type) {
      case StreamTypes$1.H264_STREAM_TYPE:
        return 'video';

      case StreamTypes$1.ADTS_STREAM_TYPE:
        return 'audio';

      case StreamTypes$1.METADATA_STREAM_TYPE:
        return 'timed-metadata';

      default:
        return null;
    }
  };

  var parsePesTime = function (packet) {
    var pusi = parsePayloadUnitStartIndicator(packet);

    if (!pusi) {
      return null;
    }

    var offset = 4 + parseAdaptionField(packet);

    if (offset >= packet.byteLength) {
      // From the H 222.0 MPEG-TS spec
      // "For transport stream packets carrying PES packets, stuffing is needed when there
      //  is insufficient PES packet data to completely fill the transport stream packet
      //  payload bytes. Stuffing is accomplished by defining an adaptation field longer than
      //  the sum of the lengths of the data elements in it, so that the payload bytes
      //  remaining after the adaptation field exactly accommodates the available PES packet
      //  data."
      //
      // If the offset is >= the length of the packet, then the packet contains no data
      // and instead is just adaption field stuffing bytes
      return null;
    }

    var pes = null;
    var ptsDtsFlags; // PES packets may be annotated with a PTS value, or a PTS value
    // and a DTS value. Determine what combination of values is
    // available to work with.

    ptsDtsFlags = packet[offset + 7]; // PTS and DTS are normally stored as a 33-bit number.  Javascript
    // performs all bitwise operations on 32-bit integers but javascript
    // supports a much greater range (52-bits) of integer using standard
    // mathematical operations.
    // We construct a 31-bit value using bitwise operators over the 31
    // most significant bits and then multiply by 4 (equal to a left-shift
    // of 2) before we add the final 2 least significant bits of the
    // timestamp (equal to an OR.)

    if (ptsDtsFlags & 0xC0) {
      pes = {}; // the PTS and DTS are not written out directly. For information
      // on how they are encoded, see
      // http://dvd.sourceforge.net/dvdinfo/pes-hdr.html

      pes.pts = (packet[offset + 9] & 0x0E) << 27 | (packet[offset + 10] & 0xFF) << 20 | (packet[offset + 11] & 0xFE) << 12 | (packet[offset + 12] & 0xFF) << 5 | (packet[offset + 13] & 0xFE) >>> 3;
      pes.pts *= 4; // Left shift by 2

      pes.pts += (packet[offset + 13] & 0x06) >>> 1; // OR by the two LSBs

      pes.dts = pes.pts;

      if (ptsDtsFlags & 0x40) {
        pes.dts = (packet[offset + 14] & 0x0E) << 27 | (packet[offset + 15] & 0xFF) << 20 | (packet[offset + 16] & 0xFE) << 12 | (packet[offset + 17] & 0xFF) << 5 | (packet[offset + 18] & 0xFE) >>> 3;
        pes.dts *= 4; // Left shift by 2

        pes.dts += (packet[offset + 18] & 0x06) >>> 1; // OR by the two LSBs
      }
    }

    return pes;
  };

  var parseNalUnitType = function (type) {
    switch (type) {
      case 0x05:
        return 'slice_layer_without_partitioning_rbsp_idr';

      case 0x06:
        return 'sei_rbsp';

      case 0x07:
        return 'seq_parameter_set_rbsp';

      case 0x08:
        return 'pic_parameter_set_rbsp';

      case 0x09:
        return 'access_unit_delimiter_rbsp';

      default:
        return null;
    }
  };

  var videoPacketContainsKeyFrame = function (packet) {
    var offset = 4 + parseAdaptionField(packet);
    var frameBuffer = packet.subarray(offset);
    var frameI = 0;
    var frameSyncPoint = 0;
    var foundKeyFrame = false;
    var nalType; // advance the sync point to a NAL start, if necessary

    for (; frameSyncPoint < frameBuffer.byteLength - 3; frameSyncPoint++) {
      if (frameBuffer[frameSyncPoint + 2] === 1) {
        // the sync point is properly aligned
        frameI = frameSyncPoint + 5;
        break;
      }
    }

    while (frameI < frameBuffer.byteLength) {
      // look at the current byte to determine if we've hit the end of
      // a NAL unit boundary
      switch (frameBuffer[frameI]) {
        case 0:
          // skip past non-sync sequences
          if (frameBuffer[frameI - 1] !== 0) {
            frameI += 2;
            break;
          } else if (frameBuffer[frameI - 2] !== 0) {
            frameI++;
            break;
          }

          if (frameSyncPoint + 3 !== frameI - 2) {
            nalType = parseNalUnitType(frameBuffer[frameSyncPoint + 3] & 0x1f);

            if (nalType === 'slice_layer_without_partitioning_rbsp_idr') {
              foundKeyFrame = true;
            }
          } // drop trailing zeroes


          do {
            frameI++;
          } while (frameBuffer[frameI] !== 1 && frameI < frameBuffer.length);

          frameSyncPoint = frameI - 2;
          frameI += 3;
          break;

        case 1:
          // skip past non-sync sequences
          if (frameBuffer[frameI - 1] !== 0 || frameBuffer[frameI - 2] !== 0) {
            frameI += 3;
            break;
          }

          nalType = parseNalUnitType(frameBuffer[frameSyncPoint + 3] & 0x1f);

          if (nalType === 'slice_layer_without_partitioning_rbsp_idr') {
            foundKeyFrame = true;
          }

          frameSyncPoint = frameI - 2;
          frameI += 3;
          break;

        default:
          // the current byte isn't a one or zero, so it cannot be part
          // of a sync sequence
          frameI += 3;
          break;
      }
    }

    frameBuffer = frameBuffer.subarray(frameSyncPoint);
    frameI -= frameSyncPoint;
    frameSyncPoint = 0; // parse the final nal

    if (frameBuffer && frameBuffer.byteLength > 3) {
      nalType = parseNalUnitType(frameBuffer[frameSyncPoint + 3] & 0x1f);

      if (nalType === 'slice_layer_without_partitioning_rbsp_idr') {
        foundKeyFrame = true;
      }
    }

    return foundKeyFrame;
  };

  var probe$1 = {
    parseType: parseType,
    parsePat: parsePat,
    parsePmt: parsePmt,
    parsePayloadUnitStartIndicator: parsePayloadUnitStartIndicator,
    parsePesType: parsePesType,
    parsePesTime: parsePesTime,
    videoPacketContainsKeyFrame: videoPacketContainsKeyFrame
  };
  /**
   * mux.js
   *
   * Copyright (c) Brightcove
   * Licensed Apache-2.0 https://github.com/videojs/mux.js/blob/master/LICENSE
   *
   * Parse mpeg2 transport stream packets to extract basic timing information
   */

  var StreamTypes = streamTypes;
  var handleRollover = timestampRolloverStream.handleRollover;
  var probe = {};
  probe.ts = probe$1;
  probe.aac = utils;
  var ONE_SECOND_IN_TS = clock$2.ONE_SECOND_IN_TS;
  var MP2T_PACKET_LENGTH = 188,
      // bytes
  SYNC_BYTE = 0x47;
  /**
   * walks through segment data looking for pat and pmt packets to parse out
   * program map table information
   */

  var parsePsi_ = function (bytes, pmt) {
    var startIndex = 0,
        endIndex = MP2T_PACKET_LENGTH,
        packet,
        type;

    while (endIndex < bytes.byteLength) {
      // Look for a pair of start and end sync bytes in the data..
      if (bytes[startIndex] === SYNC_BYTE && bytes[endIndex] === SYNC_BYTE) {
        // We found a packet
        packet = bytes.subarray(startIndex, endIndex);
        type = probe.ts.parseType(packet, pmt.pid);

        switch (type) {
          case 'pat':
            pmt.pid = probe.ts.parsePat(packet);
            break;

          case 'pmt':
            var table = probe.ts.parsePmt(packet);
            pmt.table = pmt.table || {};
            Object.keys(table).forEach(function (key) {
              pmt.table[key] = table[key];
            });
            break;
        }

        startIndex += MP2T_PACKET_LENGTH;
        endIndex += MP2T_PACKET_LENGTH;
        continue;
      } // If we get here, we have somehow become de-synchronized and we need to step
      // forward one byte at a time until we find a pair of sync bytes that denote
      // a packet


      startIndex++;
      endIndex++;
    }
  };
  /**
   * walks through the segment data from the start and end to get timing information
   * for the first and last audio pes packets
   */


  var parseAudioPes_ = function (bytes, pmt, result) {
    var startIndex = 0,
        endIndex = MP2T_PACKET_LENGTH,
        packet,
        type,
        pesType,
        pusi,
        parsed;
    var endLoop = false; // Start walking from start of segment to get first audio packet

    while (endIndex <= bytes.byteLength) {
      // Look for a pair of start and end sync bytes in the data..
      if (bytes[startIndex] === SYNC_BYTE && (bytes[endIndex] === SYNC_BYTE || endIndex === bytes.byteLength)) {
        // We found a packet
        packet = bytes.subarray(startIndex, endIndex);
        type = probe.ts.parseType(packet, pmt.pid);

        switch (type) {
          case 'pes':
            pesType = probe.ts.parsePesType(packet, pmt.table);
            pusi = probe.ts.parsePayloadUnitStartIndicator(packet);

            if (pesType === 'audio' && pusi) {
              parsed = probe.ts.parsePesTime(packet);

              if (parsed) {
                parsed.type = 'audio';
                result.audio.push(parsed);
                endLoop = true;
              }
            }

            break;
        }

        if (endLoop) {
          break;
        }

        startIndex += MP2T_PACKET_LENGTH;
        endIndex += MP2T_PACKET_LENGTH;
        continue;
      } // If we get here, we have somehow become de-synchronized and we need to step
      // forward one byte at a time until we find a pair of sync bytes that denote
      // a packet


      startIndex++;
      endIndex++;
    } // Start walking from end of segment to get last audio packet


    endIndex = bytes.byteLength;
    startIndex = endIndex - MP2T_PACKET_LENGTH;
    endLoop = false;

    while (startIndex >= 0) {
      // Look for a pair of start and end sync bytes in the data..
      if (bytes[startIndex] === SYNC_BYTE && (bytes[endIndex] === SYNC_BYTE || endIndex === bytes.byteLength)) {
        // We found a packet
        packet = bytes.subarray(startIndex, endIndex);
        type = probe.ts.parseType(packet, pmt.pid);

        switch (type) {
          case 'pes':
            pesType = probe.ts.parsePesType(packet, pmt.table);
            pusi = probe.ts.parsePayloadUnitStartIndicator(packet);

            if (pesType === 'audio' && pusi) {
              parsed = probe.ts.parsePesTime(packet);

              if (parsed) {
                parsed.type = 'audio';
                result.audio.push(parsed);
                endLoop = true;
              }
            }

            break;
        }

        if (endLoop) {
          break;
        }

        startIndex -= MP2T_PACKET_LENGTH;
        endIndex -= MP2T_PACKET_LENGTH;
        continue;
      } // If we get here, we have somehow become de-synchronized and we need to step
      // forward one byte at a time until we find a pair of sync bytes that denote
      // a packet


      startIndex--;
      endIndex--;
    }
  };
  /**
   * walks through the segment data from the start and end to get timing information
   * for the first and last video pes packets as well as timing information for the first
   * key frame.
   */


  var parseVideoPes_ = function (bytes, pmt, result) {
    var startIndex = 0,
        endIndex = MP2T_PACKET_LENGTH,
        packet,
        type,
        pesType,
        pusi,
        parsed,
        frame,
        i,
        pes;
    var endLoop = false;
    var currentFrame = {
      data: [],
      size: 0
    }; // Start walking from start of segment to get first video packet

    while (endIndex < bytes.byteLength) {
      // Look for a pair of start and end sync bytes in the data..
      if (bytes[startIndex] === SYNC_BYTE && bytes[endIndex] === SYNC_BYTE) {
        // We found a packet
        packet = bytes.subarray(startIndex, endIndex);
        type = probe.ts.parseType(packet, pmt.pid);

        switch (type) {
          case 'pes':
            pesType = probe.ts.parsePesType(packet, pmt.table);
            pusi = probe.ts.parsePayloadUnitStartIndicator(packet);

            if (pesType === 'video') {
              if (pusi && !endLoop) {
                parsed = probe.ts.parsePesTime(packet);

                if (parsed) {
                  parsed.type = 'video';
                  result.video.push(parsed);
                  endLoop = true;
                }
              }

              if (!result.firstKeyFrame) {
                if (pusi) {
                  if (currentFrame.size !== 0) {
                    frame = new Uint8Array(currentFrame.size);
                    i = 0;

                    while (currentFrame.data.length) {
                      pes = currentFrame.data.shift();
                      frame.set(pes, i);
                      i += pes.byteLength;
                    }

                    if (probe.ts.videoPacketContainsKeyFrame(frame)) {
                      var firstKeyFrame = probe.ts.parsePesTime(frame); // PTS/DTS may not be available. Simply *not* setting
                      // the keyframe seems to work fine with HLS playback
                      // and definitely preferable to a crash with TypeError...

                      if (firstKeyFrame) {
                        result.firstKeyFrame = firstKeyFrame;
                        result.firstKeyFrame.type = 'video';
                      } else {
                        // eslint-disable-next-line
                        console.warn('Failed to extract PTS/DTS from PES at first keyframe. ' + 'This could be an unusual TS segment, or else mux.js did not ' + 'parse your TS segment correctly. If you know your TS ' + 'segments do contain PTS/DTS on keyframes please file a bug ' + 'report! You can try ffprobe to double check for yourself.');
                      }
                    }

                    currentFrame.size = 0;
                  }
                }

                currentFrame.data.push(packet);
                currentFrame.size += packet.byteLength;
              }
            }

            break;
        }

        if (endLoop && result.firstKeyFrame) {
          break;
        }

        startIndex += MP2T_PACKET_LENGTH;
        endIndex += MP2T_PACKET_LENGTH;
        continue;
      } // If we get here, we have somehow become de-synchronized and we need to step
      // forward one byte at a time until we find a pair of sync bytes that denote
      // a packet


      startIndex++;
      endIndex++;
    } // Start walking from end of segment to get last video packet


    endIndex = bytes.byteLength;
    startIndex = endIndex - MP2T_PACKET_LENGTH;
    endLoop = false;

    while (startIndex >= 0) {
      // Look for a pair of start and end sync bytes in the data..
      if (bytes[startIndex] === SYNC_BYTE && bytes[endIndex] === SYNC_BYTE) {
        // We found a packet
        packet = bytes.subarray(startIndex, endIndex);
        type = probe.ts.parseType(packet, pmt.pid);

        switch (type) {
          case 'pes':
            pesType = probe.ts.parsePesType(packet, pmt.table);
            pusi = probe.ts.parsePayloadUnitStartIndicator(packet);

            if (pesType === 'video' && pusi) {
              parsed = probe.ts.parsePesTime(packet);

              if (parsed) {
                parsed.type = 'video';
                result.video.push(parsed);
                endLoop = true;
              }
            }

            break;
        }

        if (endLoop) {
          break;
        }

        startIndex -= MP2T_PACKET_LENGTH;
        endIndex -= MP2T_PACKET_LENGTH;
        continue;
      } // If we get here, we have somehow become de-synchronized and we need to step
      // forward one byte at a time until we find a pair of sync bytes that denote
      // a packet


      startIndex--;
      endIndex--;
    }
  };
  /**
   * Adjusts the timestamp information for the segment to account for
   * rollover and convert to seconds based on pes packet timescale (90khz clock)
   */


  var adjustTimestamp_ = function (segmentInfo, baseTimestamp) {
    if (segmentInfo.audio && segmentInfo.audio.length) {
      var audioBaseTimestamp = baseTimestamp;

      if (typeof audioBaseTimestamp === 'undefined' || isNaN(audioBaseTimestamp)) {
        audioBaseTimestamp = segmentInfo.audio[0].dts;
      }

      segmentInfo.audio.forEach(function (info) {
        info.dts = handleRollover(info.dts, audioBaseTimestamp);
        info.pts = handleRollover(info.pts, audioBaseTimestamp); // time in seconds

        info.dtsTime = info.dts / ONE_SECOND_IN_TS;
        info.ptsTime = info.pts / ONE_SECOND_IN_TS;
      });
    }

    if (segmentInfo.video && segmentInfo.video.length) {
      var videoBaseTimestamp = baseTimestamp;

      if (typeof videoBaseTimestamp === 'undefined' || isNaN(videoBaseTimestamp)) {
        videoBaseTimestamp = segmentInfo.video[0].dts;
      }

      segmentInfo.video.forEach(function (info) {
        info.dts = handleRollover(info.dts, videoBaseTimestamp);
        info.pts = handleRollover(info.pts, videoBaseTimestamp); // time in seconds

        info.dtsTime = info.dts / ONE_SECOND_IN_TS;
        info.ptsTime = info.pts / ONE_SECOND_IN_TS;
      });

      if (segmentInfo.firstKeyFrame) {
        var frame = segmentInfo.firstKeyFrame;
        frame.dts = handleRollover(frame.dts, videoBaseTimestamp);
        frame.pts = handleRollover(frame.pts, videoBaseTimestamp); // time in seconds

        frame.dtsTime = frame.dts / ONE_SECOND_IN_TS;
        frame.ptsTime = frame.pts / ONE_SECOND_IN_TS;
      }
    }
  };
  /**
   * inspects the aac data stream for start and end time information
   */


  var inspectAac_ = function (bytes) {
    var endLoop = false,
        audioCount = 0,
        sampleRate = null,
        timestamp = null,
        frameSize = 0,
        byteIndex = 0,
        packet;

    while (bytes.length - byteIndex >= 3) {
      var type = probe.aac.parseType(bytes, byteIndex);

      switch (type) {
        case 'timed-metadata':
          // Exit early because we don't have enough to parse
          // the ID3 tag header
          if (bytes.length - byteIndex < 10) {
            endLoop = true;
            break;
          }

          frameSize = probe.aac.parseId3TagSize(bytes, byteIndex); // Exit early if we don't have enough in the buffer
          // to emit a full packet

          if (frameSize > bytes.length) {
            endLoop = true;
            break;
          }

          if (timestamp === null) {
            packet = bytes.subarray(byteIndex, byteIndex + frameSize);
            timestamp = probe.aac.parseAacTimestamp(packet);
          }

          byteIndex += frameSize;
          break;

        case 'audio':
          // Exit early because we don't have enough to parse
          // the ADTS frame header
          if (bytes.length - byteIndex < 7) {
            endLoop = true;
            break;
          }

          frameSize = probe.aac.parseAdtsSize(bytes, byteIndex); // Exit early if we don't have enough in the buffer
          // to emit a full packet

          if (frameSize > bytes.length) {
            endLoop = true;
            break;
          }

          if (sampleRate === null) {
            packet = bytes.subarray(byteIndex, byteIndex + frameSize);
            sampleRate = probe.aac.parseSampleRate(packet);
          }

          audioCount++;
          byteIndex += frameSize;
          break;

        default:
          byteIndex++;
          break;
      }

      if (endLoop) {
        return null;
      }
    }

    if (sampleRate === null || timestamp === null) {
      return null;
    }

    var audioTimescale = ONE_SECOND_IN_TS / sampleRate;
    var result = {
      audio: [{
        type: 'audio',
        dts: timestamp,
        pts: timestamp
      }, {
        type: 'audio',
        dts: timestamp + audioCount * 1024 * audioTimescale,
        pts: timestamp + audioCount * 1024 * audioTimescale
      }]
    };
    return result;
  };
  /**
   * inspects the transport stream segment data for start and end time information
   * of the audio and video tracks (when present) as well as the first key frame's
   * start time.
   */


  var inspectTs_ = function (bytes) {
    var pmt = {
      pid: null,
      table: null
    };
    var result = {};
    parsePsi_(bytes, pmt);

    for (var pid in pmt.table) {
      if (pmt.table.hasOwnProperty(pid)) {
        var type = pmt.table[pid];

        switch (type) {
          case StreamTypes.H264_STREAM_TYPE:
            result.video = [];
            parseVideoPes_(bytes, pmt, result);

            if (result.video.length === 0) {
              delete result.video;
            }

            break;

          case StreamTypes.ADTS_STREAM_TYPE:
            result.audio = [];
            parseAudioPes_(bytes, pmt, result);

            if (result.audio.length === 0) {
              delete result.audio;
            }

            break;
        }
      }
    }

    return result;
  };
  /**
   * Inspects segment byte data and returns an object with start and end timing information
   *
   * @param {Uint8Array} bytes The segment byte data
   * @param {Number} baseTimestamp Relative reference timestamp used when adjusting frame
   *  timestamps for rollover. This value must be in 90khz clock.
   * @return {Object} Object containing start and end frame timing info of segment.
   */


  var inspect = function (bytes, baseTimestamp) {
    var isAacData = probe.aac.isLikelyAacData(bytes);
    var result;

    if (isAacData) {
      result = inspectAac_(bytes);
    } else {
      result = inspectTs_(bytes);
    }

    if (!result || !result.audio && !result.video) {
      return null;
    }

    adjustTimestamp_(result, baseTimestamp);
    return result;
  };

  var tsInspector = {
    inspect: inspect,
    parseAudioPes_: parseAudioPes_
  };
  /* global self */

  /**
   * Re-emits transmuxer events by converting them into messages to the
   * world outside the worker.
   *
   * @param {Object} transmuxer the transmuxer to wire events on
   * @private
   */

  const wireTransmuxerEvents = function (self, transmuxer) {
    transmuxer.on('data', function (segment) {
      // transfer ownership of the underlying ArrayBuffer
      // instead of doing a copy to save memory
      // ArrayBuffers are transferable but generic TypedArrays are not
      // @link https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Using_web_workers#Passing_data_by_transferring_ownership_(transferable_objects)
      const initArray = segment.initSegment;
      segment.initSegment = {
        data: initArray.buffer,
        byteOffset: initArray.byteOffset,
        byteLength: initArray.byteLength
      };
      const typedArray = segment.data;
      segment.data = typedArray.buffer;
      self.postMessage({
        action: 'data',
        segment,
        byteOffset: typedArray.byteOffset,
        byteLength: typedArray.byteLength
      }, [segment.data]);
    });
    transmuxer.on('done', function (data) {
      self.postMessage({
        action: 'done'
      });
    });
    transmuxer.on('gopInfo', function (gopInfo) {
      self.postMessage({
        action: 'gopInfo',
        gopInfo
      });
    });
    transmuxer.on('videoSegmentTimingInfo', function (timingInfo) {
      const videoSegmentTimingInfo = {
        start: {
          decode: clock$2.videoTsToSeconds(timingInfo.start.dts),
          presentation: clock$2.videoTsToSeconds(timingInfo.start.pts)
        },
        end: {
          decode: clock$2.videoTsToSeconds(timingInfo.end.dts),
          presentation: clock$2.videoTsToSeconds(timingInfo.end.pts)
        },
        baseMediaDecodeTime: clock$2.videoTsToSeconds(timingInfo.baseMediaDecodeTime)
      };

      if (timingInfo.prependedContentDuration) {
        videoSegmentTimingInfo.prependedContentDuration = clock$2.videoTsToSeconds(timingInfo.prependedContentDuration);
      }

      self.postMessage({
        action: 'videoSegmentTimingInfo',
        videoSegmentTimingInfo
      });
    });
    transmuxer.on('audioSegmentTimingInfo', function (timingInfo) {
      // Note that all times for [audio/video]SegmentTimingInfo events are in video clock
      const audioSegmentTimingInfo = {
        start: {
          decode: clock$2.videoTsToSeconds(timingInfo.start.dts),
          presentation: clock$2.videoTsToSeconds(timingInfo.start.pts)
        },
        end: {
          decode: clock$2.videoTsToSeconds(timingInfo.end.dts),
          presentation: clock$2.videoTsToSeconds(timingInfo.end.pts)
        },
        baseMediaDecodeTime: clock$2.videoTsToSeconds(timingInfo.baseMediaDecodeTime)
      };

      if (timingInfo.prependedContentDuration) {
        audioSegmentTimingInfo.prependedContentDuration = clock$2.videoTsToSeconds(timingInfo.prependedContentDuration);
      }

      self.postMessage({
        action: 'audioSegmentTimingInfo',
        audioSegmentTimingInfo
      });
    });
    transmuxer.on('id3Frame', function (id3Frame) {
      self.postMessage({
        action: 'id3Frame',
        id3Frame
      });
    });
    transmuxer.on('caption', function (caption) {
      self.postMessage({
        action: 'caption',
        caption
      });
    });
    transmuxer.on('trackinfo', function (trackInfo) {
      self.postMessage({
        action: 'trackinfo',
        trackInfo
      });
    });
    transmuxer.on('audioTimingInfo', function (audioTimingInfo) {
      // convert to video TS since we prioritize video time over audio
      self.postMessage({
        action: 'audioTimingInfo',
        audioTimingInfo: {
          start: clock$2.videoTsToSeconds(audioTimingInfo.start),
          end: clock$2.videoTsToSeconds(audioTimingInfo.end)
        }
      });
    });
    transmuxer.on('videoTimingInfo', function (videoTimingInfo) {
      self.postMessage({
        action: 'videoTimingInfo',
        videoTimingInfo: {
          start: clock$2.videoTsToSeconds(videoTimingInfo.start),
          end: clock$2.videoTsToSeconds(videoTimingInfo.end)
        }
      });
    });
    transmuxer.on('log', function (log) {
      self.postMessage({
        action: 'log',
        log
      });
    });
  };
  /**
   * All incoming messages route through this hash. If no function exists
   * to handle an incoming message, then we ignore the message.
   *
   * @class MessageHandlers
   * @param {Object} options the options to initialize with
   */


  class MessageHandlers {
    constructor(self, options) {
      this.options = options || {};
      this.self = self;
      this.init();
    }
    /**
     * initialize our web worker and wire all the events.
     */


    init() {
      if (this.transmuxer) {
        this.transmuxer.dispose();
      }

      this.transmuxer = new transmuxer.Transmuxer(this.options);
      wireTransmuxerEvents(this.self, this.transmuxer);
    }

    pushMp4Captions(data) {
      if (!this.captionParser) {
        this.captionParser = new captionParser();
        this.captionParser.init();
      }

      const segment = new Uint8Array(data.data, data.byteOffset, data.byteLength);
      const parsed = this.captionParser.parse(segment, data.trackIds, data.timescales);
      this.self.postMessage({
        action: 'mp4Captions',
        captions: parsed && parsed.captions || [],
        logs: parsed && parsed.logs || [],
        data: segment.buffer
      }, [segment.buffer]);
    }

    probeMp4StartTime({
      timescales,
      data
    }) {
      const startTime = probe$2.startTime(timescales, data);
      this.self.postMessage({
        action: 'probeMp4StartTime',
        startTime,
        data
      }, [data.buffer]);
    }

    probeMp4Tracks({
      data
    }) {
      const tracks = probe$2.tracks(data);
      this.self.postMessage({
        action: 'probeMp4Tracks',
        tracks,
        data
      }, [data.buffer]);
    }
    /**
     * Probes an mp4 segment for EMSG boxes containing ID3 data.
     * https://aomediacodec.github.io/id3-emsg/
     *
     * @param {Uint8Array} data segment data
     * @param {number} offset segment start time
     * @return {Object[]} an array of ID3 frames
     */


    probeEmsgID3({
      data,
      offset
    }) {
      const id3Frames = probe$2.getEmsgID3(data, offset);
      this.self.postMessage({
        action: 'probeEmsgID3',
        id3Frames,
        emsgData: data
      }, [data.buffer]);
    }
    /**
     * Probe an mpeg2-ts segment to determine the start time of the segment in it's
     * internal "media time," as well as whether it contains video and/or audio.
     *
     * @private
     * @param {Uint8Array} bytes - segment bytes
     * @param {number} baseStartTime
     *        Relative reference timestamp used when adjusting frame timestamps for rollover.
     *        This value should be in seconds, as it's converted to a 90khz clock within the
     *        function body.
     * @return {Object} The start time of the current segment in "media time" as well as
     *                  whether it contains video and/or audio
     */


    probeTs({
      data,
      baseStartTime
    }) {
      const tsStartTime = typeof baseStartTime === 'number' && !isNaN(baseStartTime) ? baseStartTime * clock$2.ONE_SECOND_IN_TS : void 0;
      const timeInfo = tsInspector.inspect(data, tsStartTime);
      let result = null;

      if (timeInfo) {
        result = {
          // each type's time info comes back as an array of 2 times, start and end
          hasVideo: timeInfo.video && timeInfo.video.length === 2 || false,
          hasAudio: timeInfo.audio && timeInfo.audio.length === 2 || false
        };

        if (result.hasVideo) {
          result.videoStart = timeInfo.video[0].ptsTime;
        }

        if (result.hasAudio) {
          result.audioStart = timeInfo.audio[0].ptsTime;
        }
      }

      this.self.postMessage({
        action: 'probeTs',
        result,
        data
      }, [data.buffer]);
    }

    clearAllMp4Captions() {
      if (this.captionParser) {
        this.captionParser.clearAllCaptions();
      }
    }

    clearParsedMp4Captions() {
      if (this.captionParser) {
        this.captionParser.clearParsedCaptions();
      }
    }
    /**
     * Adds data (a ts segment) to the start of the transmuxer pipeline for
     * processing.
     *
     * @param {ArrayBuffer} data data to push into the muxer
     */


    push(data) {
      // Cast array buffer to correct type for transmuxer
      const segment = new Uint8Array(data.data, data.byteOffset, data.byteLength);
      this.transmuxer.push(segment);
    }
    /**
     * Recreate the transmuxer so that the next segment added via `push`
     * start with a fresh transmuxer.
     */


    reset() {
      this.transmuxer.reset();
    }
    /**
     * Set the value that will be used as the `baseMediaDecodeTime` time for the
     * next segment pushed in. Subsequent segments will have their `baseMediaDecodeTime`
     * set relative to the first based on the PTS values.
     *
     * @param {Object} data used to set the timestamp offset in the muxer
     */


    setTimestampOffset(data) {
      const timestampOffset = data.timestampOffset || 0;
      this.transmuxer.setBaseMediaDecodeTime(Math.round(clock$2.secondsToVideoTs(timestampOffset)));
    }

    setAudioAppendStart(data) {
      this.transmuxer.setAudioAppendStart(Math.ceil(clock$2.secondsToVideoTs(data.appendStart)));
    }

    setRemux(data) {
      this.transmuxer.setRemux(data.remux);
    }
    /**
     * Forces the pipeline to finish processing the last segment and emit it's
     * results.
     *
     * @param {Object} data event data, not really used
     */


    flush(data) {
      this.transmuxer.flush(); // transmuxed done action is fired after both audio/video pipelines are flushed

      self.postMessage({
        action: 'done',
        type: 'transmuxed'
      });
    }

    endTimeline() {
      this.transmuxer.endTimeline(); // transmuxed endedtimeline action is fired after both audio/video pipelines end their
      // timelines

      self.postMessage({
        action: 'endedtimeline',
        type: 'transmuxed'
      });
    }

    alignGopsWith(data) {
      this.transmuxer.alignGopsWith(data.gopsToAlignWith.slice());
    }

  }
  /**
   * Our web worker interface so that things can talk to mux.js
   * that will be running in a web worker. the scope is passed to this by
   * webworkify.
   *
   * @param {Object} self the scope for the web worker
   */


  self.onmessage = function (event) {
    if (event.data.action === 'init' && event.data.options) {
      this.messageHandlers = new MessageHandlers(self, event.data.options);
      return;
    }

    if (!this.messageHandlers) {
      this.messageHandlers = new MessageHandlers(self);
    }

    if (event.data && event.data.action && event.data.action !== 'init') {
      if (this.messageHandlers[event.data.action]) {
        this.messageHandlers[event.data.action](event.data);
      }
    }
  };
}));
var TransmuxWorker = factory(workerCode$1);
/* rollup-plugin-worker-factory end for worker!/home/runner/work/http-streaming/http-streaming/src/transmuxer-worker.js */

const handleData_ = (event, transmuxedData, callback) => {
  const {
    type,
    initSegment,
    captions,
    captionStreams,
    metadata,
    videoFrameDtsTime,
    videoFramePtsTime
  } = event.data.segment;
  transmuxedData.buffer.push({
    captions,
    captionStreams,
    metadata
  });
  const boxes = event.data.segment.boxes || {
    data: event.data.segment.data
  };
  const result = {
    type,
    // cast ArrayBuffer to TypedArray
    data: new Uint8Array(boxes.data, boxes.data.byteOffset, boxes.data.byteLength),
    initSegment: new Uint8Array(initSegment.data, initSegment.byteOffset, initSegment.byteLength)
  };

  if (typeof videoFrameDtsTime !== 'undefined') {
    result.videoFrameDtsTime = videoFrameDtsTime;
  }

  if (typeof videoFramePtsTime !== 'undefined') {
    result.videoFramePtsTime = videoFramePtsTime;
  }

  callback(result);
};
const handleDone_ = ({
  transmuxedData,
  callback
}) => {
  // Previously we only returned data on data events,
  // not on done events. Clear out the buffer to keep that consistent.
  transmuxedData.buffer = []; // all buffers should have been flushed from the muxer, so start processing anything we
  // have received

  callback(transmuxedData);
};
const handleGopInfo_ = (event, transmuxedData) => {
  transmuxedData.gopInfo = event.data.gopInfo;
};
const processTransmux = options => {
  const {
    transmuxer,
    bytes,
    audioAppendStart,
    gopsToAlignWith,
    remux,
    onData,
    onTrackInfo,
    onAudioTimingInfo,
    onVideoTimingInfo,
    onVideoSegmentTimingInfo,
    onAudioSegmentTimingInfo,
    onId3,
    onCaptions,
    onDone,
    onEndedTimeline,
    onTransmuxerLog,
    isEndOfTimeline
  } = options;
  const transmuxedData = {
    buffer: []
  };
  let waitForEndedTimelineEvent = isEndOfTimeline;

  const handleMessage = event => {
    if (transmuxer.currentTransmux !== options) {
      // disposed
      return;
    }

    if (event.data.action === 'data') {
      handleData_(event, transmuxedData, onData);
    }

    if (event.data.action === 'trackinfo') {
      onTrackInfo(event.data.trackInfo);
    }

    if (event.data.action === 'gopInfo') {
      handleGopInfo_(event, transmuxedData);
    }

    if (event.data.action === 'audioTimingInfo') {
      onAudioTimingInfo(event.data.audioTimingInfo);
    }

    if (event.data.action === 'videoTimingInfo') {
      onVideoTimingInfo(event.data.videoTimingInfo);
    }

    if (event.data.action === 'videoSegmentTimingInfo') {
      onVideoSegmentTimingInfo(event.data.videoSegmentTimingInfo);
    }

    if (event.data.action === 'audioSegmentTimingInfo') {
      onAudioSegmentTimingInfo(event.data.audioSegmentTimingInfo);
    }

    if (event.data.action === 'id3Frame') {
      onId3([event.data.id3Frame], event.data.id3Frame.dispatchType);
    }

    if (event.data.action === 'caption') {
      onCaptions(event.data.caption);
    }

    if (event.data.action === 'endedtimeline') {
      waitForEndedTimelineEvent = false;
      onEndedTimeline();
    }

    if (event.data.action === 'log') {
      onTransmuxerLog(event.data.log);
    } // wait for the transmuxed event since we may have audio and video


    if (event.data.type !== 'transmuxed') {
      return;
    } // If the "endedtimeline" event has not yet fired, and this segment represents the end
    // of a timeline, that means there may still be data events before the segment
    // processing can be considerred complete. In that case, the final event should be
    // an "endedtimeline" event with the type "transmuxed."


    if (waitForEndedTimelineEvent) {
      return;
    }

    transmuxer.onmessage = null;
    handleDone_({
      transmuxedData,
      callback: onDone
    });
    /* eslint-disable no-use-before-define */

    dequeue(transmuxer);
    /* eslint-enable */
  };

  transmuxer.onmessage = handleMessage;

  if (audioAppendStart) {
    transmuxer.postMessage({
      action: 'setAudioAppendStart',
      appendStart: audioAppendStart
    });
  } // allow empty arrays to be passed to clear out GOPs


  if (Array.isArray(gopsToAlignWith)) {
    transmuxer.postMessage({
      action: 'alignGopsWith',
      gopsToAlignWith
    });
  }

  if (typeof remux !== 'undefined') {
    transmuxer.postMessage({
      action: 'setRemux',
      remux
    });
  }

  if (bytes.byteLength) {
    const buffer = bytes instanceof ArrayBuffer ? bytes : bytes.buffer;
    const byteOffset = bytes instanceof ArrayBuffer ? 0 : bytes.byteOffset;
    transmuxer.postMessage({
      action: 'push',
      // Send the typed-array of data as an ArrayBuffer so that
      // it can be sent as a "Transferable" and avoid the costly
      // memory copy
      data: buffer,
      // To recreate the original typed-array, we need information
      // about what portion of the ArrayBuffer it was a view into
      byteOffset,
      byteLength: bytes.byteLength
    }, [buffer]);
  }

  if (isEndOfTimeline) {
    transmuxer.postMessage({
      action: 'endTimeline'
    });
  } // even if we didn't push any bytes, we have to make sure we flush in case we reached
  // the end of the segment


  transmuxer.postMessage({
    action: 'flush'
  });
};
const dequeue = transmuxer => {
  transmuxer.currentTransmux = null;

  if (transmuxer.transmuxQueue.length) {
    transmuxer.currentTransmux = transmuxer.transmuxQueue.shift();

    if (typeof transmuxer.currentTransmux === 'function') {
      transmuxer.currentTransmux();
    } else {
      processTransmux(transmuxer.currentTransmux);
    }
  }
};
const processAction = (transmuxer, action) => {
  transmuxer.postMessage({
    action
  });
  dequeue(transmuxer);
};
const enqueueAction = (action, transmuxer) => {
  if (!transmuxer.currentTransmux) {
    transmuxer.currentTransmux = action;
    processAction(transmuxer, action);
    return;
  }

  transmuxer.transmuxQueue.push(processAction.bind(null, transmuxer, action));
};
const reset = transmuxer => {
  enqueueAction('reset', transmuxer);
};
const endTimeline = transmuxer => {
  enqueueAction('endTimeline', transmuxer);
};
const transmux = options => {
  if (!options.transmuxer.currentTransmux) {
    options.transmuxer.currentTransmux = options;
    processTransmux(options);
    return;
  }

  options.transmuxer.transmuxQueue.push(options);
};
const createTransmuxer = options => {
  const transmuxer = new TransmuxWorker();
  transmuxer.currentTransmux = null;
  transmuxer.transmuxQueue = [];
  const term = transmuxer.terminate;

  transmuxer.terminate = () => {
    transmuxer.currentTransmux = null;
    transmuxer.transmuxQueue.length = 0;
    return term.call(transmuxer);
  };

  transmuxer.postMessage({
    action: 'init',
    options
  });
  return transmuxer;
};
var segmentTransmuxer = {
  reset,
  endTimeline,
  transmux,
  createTransmuxer
};

const workerCallback = function (options) {
  const transmuxer = options.transmuxer;
  const endAction = options.endAction || options.action;
  const callback = options.callback;

  const message = _extends({}, options, {
    endAction: null,
    transmuxer: null,
    callback: null
  });

  const listenForEndEvent = event => {
    if (event.data.action !== endAction) {
      return;
    }

    transmuxer.removeEventListener('message', listenForEndEvent); // transfer ownership of bytes back to us.

    if (event.data.data) {
      event.data.data = new Uint8Array(event.data.data, options.byteOffset || 0, options.byteLength || event.data.data.byteLength);

      if (options.data) {
        options.data = event.data.data;
      }
    }

    callback(event.data);
  };

  transmuxer.addEventListener('message', listenForEndEvent);

  if (options.data) {
    const isArrayBuffer = options.data instanceof ArrayBuffer;
    message.byteOffset = isArrayBuffer ? 0 : options.data.byteOffset;
    message.byteLength = options.data.byteLength;
    const transfers = [isArrayBuffer ? options.data : options.data.buffer];
    transmuxer.postMessage(message, transfers);
  } else {
    transmuxer.postMessage(message);
  }
};

const REQUEST_ERRORS = {
  FAILURE: 2,
  TIMEOUT: -101,
  ABORTED: -102
};
/**
 * Abort all requests
 *
 * @param {Object} activeXhrs - an object that tracks all XHR requests
 */

const abortAll = activeXhrs => {
  activeXhrs.forEach(xhr => {
    xhr.abort();
  });
};
/**
 * Gather important bandwidth stats once a request has completed
 *
 * @param {Object} request - the XHR request from which to gather stats
 */


const getRequestStats = request => {
  return {
    bandwidth: request.bandwidth,
    bytesReceived: request.bytesReceived || 0,
    roundTripTime: request.roundTripTime || 0
  };
};
/**
 * If possible gather bandwidth stats as a request is in
 * progress
 *
 * @param {Event} progressEvent - an event object from an XHR's progress event
 */


const getProgressStats = progressEvent => {
  const request = progressEvent.target;
  const roundTripTime = Date.now() - request.requestTime;
  const stats = {
    bandwidth: Infinity,
    bytesReceived: 0,
    roundTripTime: roundTripTime || 0
  };
  stats.bytesReceived = progressEvent.loaded; // This can result in Infinity if stats.roundTripTime is 0 but that is ok
  // because we should only use bandwidth stats on progress to determine when
  // abort a request early due to insufficient bandwidth

  stats.bandwidth = Math.floor(stats.bytesReceived / stats.roundTripTime * 8 * 1000);
  return stats;
};
/**
 * Handle all error conditions in one place and return an object
 * with all the information
 *
 * @param {Error|null} error - if non-null signals an error occured with the XHR
 * @param {Object} request -  the XHR request that possibly generated the error
 */


const handleErrors = (error, request) => {
  if (request.timedout) {
    return {
      status: request.status,
      message: 'HLS request timed-out at URL: ' + request.uri,
      code: REQUEST_ERRORS.TIMEOUT,
      xhr: request
    };
  }

  if (request.aborted) {
    return {
      status: request.status,
      message: 'HLS request aborted at URL: ' + request.uri,
      code: REQUEST_ERRORS.ABORTED,
      xhr: request
    };
  }

  if (error) {
    return {
      status: request.status,
      message: 'HLS request errored at URL: ' + request.uri,
      code: REQUEST_ERRORS.FAILURE,
      xhr: request
    };
  }

  if (request.responseType === 'arraybuffer' && request.response.byteLength === 0) {
    return {
      status: request.status,
      message: 'Empty HLS response at URL: ' + request.uri,
      code: REQUEST_ERRORS.FAILURE,
      xhr: request
    };
  }

  return null;
};
/**
 * Handle responses for key data and convert the key data to the correct format
 * for the decryption step later
 *
 * @param {Object} segment - a simplified copy of the segmentInfo object
 *                           from SegmentLoader
 * @param {Array} objects - objects to add the key bytes to.
 * @param {Function} finishProcessingFn - a callback to execute to continue processing
 *                                        this request
 */


const handleKeyResponse = (segment, objects, finishProcessingFn) => (error, request) => {
  const response = request.response;
  const errorObj = handleErrors(error, request);

  if (errorObj) {
    return finishProcessingFn(errorObj, segment);
  }

  if (response.byteLength !== 16) {
    return finishProcessingFn({
      status: request.status,
      message: 'Invalid HLS key at URL: ' + request.uri,
      code: REQUEST_ERRORS.FAILURE,
      xhr: request
    }, segment);
  }

  const view = new DataView(response);
  const bytes = new Uint32Array([view.getUint32(0), view.getUint32(4), view.getUint32(8), view.getUint32(12)]);

  for (let i = 0; i < objects.length; i++) {
    objects[i].bytes = bytes;
  }

  return finishProcessingFn(null, segment);
};

const parseInitSegment = (segment, callback) => {
  const type = detectContainerForBytes(segment.map.bytes); // TODO: We should also handle ts init segments here, but we
  // only know how to parse mp4 init segments at the moment

  if (type !== 'mp4') {
    const uri = segment.map.resolvedUri || segment.map.uri;
    return callback({
      internal: true,
      message: `Found unsupported ${type || 'unknown'} container for initialization segment at URL: ${uri}`,
      code: REQUEST_ERRORS.FAILURE
    });
  }

  workerCallback({
    action: 'probeMp4Tracks',
    data: segment.map.bytes,
    transmuxer: segment.transmuxer,
    callback: ({
      tracks,
      data
    }) => {
      // transfer bytes back to us
      segment.map.bytes = data;
      tracks.forEach(function (track) {
        segment.map.tracks = segment.map.tracks || {}; // only support one track of each type for now

        if (segment.map.tracks[track.type]) {
          return;
        }

        segment.map.tracks[track.type] = track;

        if (typeof track.id === 'number' && track.timescale) {
          segment.map.timescales = segment.map.timescales || {};
          segment.map.timescales[track.id] = track.timescale;
        }
      });
      return callback(null);
    }
  });
};
/**
 * Handle init-segment responses
 *
 * @param {Object} segment - a simplified copy of the segmentInfo object
 *                           from SegmentLoader
 * @param {Function} finishProcessingFn - a callback to execute to continue processing
 *                                        this request
 */


const handleInitSegmentResponse = ({
  segment,
  finishProcessingFn
}) => (error, request) => {
  const errorObj = handleErrors(error, request);

  if (errorObj) {
    return finishProcessingFn(errorObj, segment);
  }

  const bytes = new Uint8Array(request.response); // init segment is encypted, we will have to wait
  // until the key request is done to decrypt.

  if (segment.map.key) {
    segment.map.encryptedBytes = bytes;
    return finishProcessingFn(null, segment);
  }

  segment.map.bytes = bytes;
  parseInitSegment(segment, function (parseError) {
    if (parseError) {
      parseError.xhr = request;
      parseError.status = request.status;
      return finishProcessingFn(parseError, segment);
    }

    finishProcessingFn(null, segment);
  });
};
/**
 * Response handler for segment-requests being sure to set the correct
 * property depending on whether the segment is encryped or not
 * Also records and keeps track of stats that are used for ABR purposes
 *
 * @param {Object} segment - a simplified copy of the segmentInfo object
 *                           from SegmentLoader
 * @param {Function} finishProcessingFn - a callback to execute to continue processing
 *                                        this request
 */


const handleSegmentResponse = ({
  segment,
  finishProcessingFn,
  responseType
}) => (error, request) => {
  const errorObj = handleErrors(error, request);

  if (errorObj) {
    return finishProcessingFn(errorObj, segment);
  }

  const newBytes = // although responseText "should" exist, this guard serves to prevent an error being
  // thrown for two primary cases:
  // 1. the mime type override stops working, or is not implemented for a specific
  //    browser
  // 2. when using mock XHR libraries like sinon that do not allow the override behavior
  responseType === 'arraybuffer' || !request.responseText ? request.response : stringToArrayBuffer(request.responseText.substring(segment.lastReachedChar || 0));
  segment.stats = getRequestStats(request);

  if (segment.key) {
    segment.encryptedBytes = new Uint8Array(newBytes);
  } else {
    segment.bytes = new Uint8Array(newBytes);
  }

  return finishProcessingFn(null, segment);
};

const transmuxAndNotify = ({
  segment,
  bytes,
  trackInfoFn,
  timingInfoFn,
  videoSegmentTimingInfoFn,
  audioSegmentTimingInfoFn,
  id3Fn,
  captionsFn,
  isEndOfTimeline,
  endedTimelineFn,
  dataFn,
  doneFn,
  onTransmuxerLog
}) => {
  const fmp4Tracks = segment.map && segment.map.tracks || {};
  const isMuxed = Boolean(fmp4Tracks.audio && fmp4Tracks.video); // Keep references to each function so we can null them out after we're done with them.
  // One reason for this is that in the case of full segments, we want to trust start
  // times from the probe, rather than the transmuxer.

  let audioStartFn = timingInfoFn.bind(null, segment, 'audio', 'start');
  const audioEndFn = timingInfoFn.bind(null, segment, 'audio', 'end');
  let videoStartFn = timingInfoFn.bind(null, segment, 'video', 'start');
  const videoEndFn = timingInfoFn.bind(null, segment, 'video', 'end');

  const finish = () => transmux({
    bytes,
    transmuxer: segment.transmuxer,
    audioAppendStart: segment.audioAppendStart,
    gopsToAlignWith: segment.gopsToAlignWith,
    remux: isMuxed,
    onData: result => {
      result.type = result.type === 'combined' ? 'video' : result.type;
      dataFn(segment, result);
    },
    onTrackInfo: trackInfo => {
      if (trackInfoFn) {
        if (isMuxed) {
          trackInfo.isMuxed = true;
        }

        trackInfoFn(segment, trackInfo);
      }
    },
    onAudioTimingInfo: audioTimingInfo => {
      // we only want the first start value we encounter
      if (audioStartFn && typeof audioTimingInfo.start !== 'undefined') {
        audioStartFn(audioTimingInfo.start);
        audioStartFn = null;
      } // we want to continually update the end time


      if (audioEndFn && typeof audioTimingInfo.end !== 'undefined') {
        audioEndFn(audioTimingInfo.end);
      }
    },
    onVideoTimingInfo: videoTimingInfo => {
      // we only want the first start value we encounter
      if (videoStartFn && typeof videoTimingInfo.start !== 'undefined') {
        videoStartFn(videoTimingInfo.start);
        videoStartFn = null;
      } // we want to continually update the end time


      if (videoEndFn && typeof videoTimingInfo.end !== 'undefined') {
        videoEndFn(videoTimingInfo.end);
      }
    },
    onVideoSegmentTimingInfo: videoSegmentTimingInfo => {
      videoSegmentTimingInfoFn(videoSegmentTimingInfo);
    },
    onAudioSegmentTimingInfo: audioSegmentTimingInfo => {
      audioSegmentTimingInfoFn(audioSegmentTimingInfo);
    },
    onId3: (id3Frames, dispatchType) => {
      id3Fn(segment, id3Frames, dispatchType);
    },
    onCaptions: captions => {
      captionsFn(segment, [captions]);
    },
    isEndOfTimeline,
    onEndedTimeline: () => {
      endedTimelineFn();
    },
    onTransmuxerLog,
    onDone: result => {
      if (!doneFn) {
        return;
      }

      result.type = result.type === 'combined' ? 'video' : result.type;
      doneFn(null, segment, result);
    }
  }); // In the transmuxer, we don't yet have the ability to extract a "proper" start time.
  // Meaning cached frame data may corrupt our notion of where this segment
  // really starts. To get around this, probe for the info needed.


  workerCallback({
    action: 'probeTs',
    transmuxer: segment.transmuxer,
    data: bytes,
    baseStartTime: segment.baseStartTime,
    callback: data => {
      segment.bytes = bytes = data.data;
      const probeResult = data.result;

      if (probeResult) {
        trackInfoFn(segment, {
          hasAudio: probeResult.hasAudio,
          hasVideo: probeResult.hasVideo,
          isMuxed
        });
        trackInfoFn = null;
      }

      finish();
    }
  });
};

const handleSegmentBytes = ({
  segment,
  bytes,
  trackInfoFn,
  timingInfoFn,
  videoSegmentTimingInfoFn,
  audioSegmentTimingInfoFn,
  id3Fn,
  captionsFn,
  isEndOfTimeline,
  endedTimelineFn,
  dataFn,
  doneFn,
  onTransmuxerLog
}) => {
  let bytesAsUint8Array = new Uint8Array(bytes); // TODO:
  // We should have a handler that fetches the number of bytes required
  // to check if something is fmp4. This will allow us to save bandwidth
  // because we can only exclude a playlist and abort requests
  // by codec after trackinfo triggers.

  if (isLikelyFmp4MediaSegment(bytesAsUint8Array)) {
    segment.isFmp4 = true;
    const {
      tracks
    } = segment.map;
    const trackInfo = {
      isFmp4: true,
      hasVideo: !!tracks.video,
      hasAudio: !!tracks.audio
    }; // if we have a audio track, with a codec that is not set to
    // encrypted audio

    if (tracks.audio && tracks.audio.codec && tracks.audio.codec !== 'enca') {
      trackInfo.audioCodec = tracks.audio.codec;
    } // if we have a video track, with a codec that is not set to
    // encrypted video


    if (tracks.video && tracks.video.codec && tracks.video.codec !== 'encv') {
      trackInfo.videoCodec = tracks.video.codec;
    }

    if (tracks.video && tracks.audio) {
      trackInfo.isMuxed = true;
    } // since we don't support appending fmp4 data on progress, we know we have the full
    // segment here


    trackInfoFn(segment, trackInfo); // The probe doesn't provide the segment end time, so only callback with the start
    // time. The end time can be roughly calculated by the receiver using the duration.
    //
    // Note that the start time returned by the probe reflects the baseMediaDecodeTime, as
    // that is the true start of the segment (where the playback engine should begin
    // decoding).

    const finishLoading = (captions, id3Frames) => {
      // if the track still has audio at this point it is only possible
      // for it to be audio only. See `tracks.video && tracks.audio` if statement
      // above.
      // we make sure to use segment.bytes here as that
      dataFn(segment, {
        data: bytesAsUint8Array,
        type: trackInfo.hasAudio && !trackInfo.isMuxed ? 'audio' : 'video'
      });

      if (id3Frames && id3Frames.length) {
        id3Fn(segment, id3Frames);
      }

      if (captions && captions.length) {
        captionsFn(segment, captions);
      }

      doneFn(null, segment, {});
    };

    workerCallback({
      action: 'probeMp4StartTime',
      timescales: segment.map.timescales,
      data: bytesAsUint8Array,
      transmuxer: segment.transmuxer,
      callback: ({
        data,
        startTime
      }) => {
        // transfer bytes back to us
        bytes = data.buffer;
        segment.bytes = bytesAsUint8Array = data;

        if (trackInfo.hasAudio && !trackInfo.isMuxed) {
          timingInfoFn(segment, 'audio', 'start', startTime);
        }

        if (trackInfo.hasVideo) {
          timingInfoFn(segment, 'video', 'start', startTime);
        }

        workerCallback({
          action: 'probeEmsgID3',
          data: bytesAsUint8Array,
          transmuxer: segment.transmuxer,
          offset: startTime,
          callback: ({
            emsgData,
            id3Frames
          }) => {
            // transfer bytes back to us
            bytes = emsgData.buffer;
            segment.bytes = bytesAsUint8Array = emsgData; // Run through the CaptionParser in case there are captions.
            // Initialize CaptionParser if it hasn't been yet

            if (!tracks.video || !emsgData.byteLength || !segment.transmuxer) {
              finishLoading(undefined, id3Frames);
              return;
            }

            workerCallback({
              action: 'pushMp4Captions',
              endAction: 'mp4Captions',
              transmuxer: segment.transmuxer,
              data: bytesAsUint8Array,
              timescales: segment.map.timescales,
              trackIds: [tracks.video.id],
              callback: message => {
                // transfer bytes back to us
                bytes = message.data.buffer;
                segment.bytes = bytesAsUint8Array = message.data;
                message.logs.forEach(function (log) {
                  onTransmuxerLog(merge(log, {
                    stream: 'mp4CaptionParser'
                  }));
                });
                finishLoading(message.captions, id3Frames);
              }
            });
          }
        });
      }
    });
    return;
  } // VTT or other segments that don't need processing


  if (!segment.transmuxer) {
    doneFn(null, segment, {});
    return;
  }

  if (typeof segment.container === 'undefined') {
    segment.container = detectContainerForBytes(bytesAsUint8Array);
  }

  if (segment.container !== 'ts' && segment.container !== 'aac' && segment.container !== 'h264') {
    trackInfoFn(segment, {
      hasAudio: false,
      hasVideo: false
    });
    doneFn(null, segment, {});
    return;
  } // ts or aac


  transmuxAndNotify({
    segment,
    bytes,
    trackInfoFn,
    timingInfoFn,
    videoSegmentTimingInfoFn,
    audioSegmentTimingInfoFn,
    id3Fn,
    captionsFn,
    isEndOfTimeline,
    endedTimelineFn,
    dataFn,
    doneFn,
    onTransmuxerLog
  });
};

const decrypt = function ({
  id,
  key,
  encryptedBytes,
  decryptionWorker
}, callback) {
  const decryptionHandler = event => {
    if (event.data.source === id) {
      decryptionWorker.removeEventListener('message', decryptionHandler);
      const decrypted = event.data.decrypted;
      callback(new Uint8Array(decrypted.bytes, decrypted.byteOffset, decrypted.byteLength));
    }
  };

  decryptionWorker.addEventListener('message', decryptionHandler);
  let keyBytes;

  if (key.bytes.slice) {
    keyBytes = key.bytes.slice();
  } else {
    keyBytes = new Uint32Array(Array.prototype.slice.call(key.bytes));
  } // incrementally decrypt the bytes


  decryptionWorker.postMessage(createTransferableMessage({
    source: id,
    encrypted: encryptedBytes,
    key: keyBytes,
    iv: key.iv
  }), [encryptedBytes.buffer, keyBytes.buffer]);
};
/**
 * Decrypt the segment via the decryption web worker
 *
 * @param {WebWorker} decryptionWorker - a WebWorker interface to AES-128 decryption
 *                                       routines
 * @param {Object} segment - a simplified copy of the segmentInfo object
 *                           from SegmentLoader
 * @param {Function} trackInfoFn - a callback that receives track info
 * @param {Function} timingInfoFn - a callback that receives timing info
 * @param {Function} videoSegmentTimingInfoFn
 *                   a callback that receives video timing info based on media times and
 *                   any adjustments made by the transmuxer
 * @param {Function} audioSegmentTimingInfoFn
 *                   a callback that receives audio timing info based on media times and
 *                   any adjustments made by the transmuxer
 * @param {boolean}  isEndOfTimeline
 *                   true if this segment represents the last segment in a timeline
 * @param {Function} endedTimelineFn
 *                   a callback made when a timeline is ended, will only be called if
 *                   isEndOfTimeline is true
 * @param {Function} dataFn - a callback that is executed when segment bytes are available
 *                            and ready to use
 * @param {Function} doneFn - a callback that is executed after decryption has completed
 */


const decryptSegment = ({
  decryptionWorker,
  segment,
  trackInfoFn,
  timingInfoFn,
  videoSegmentTimingInfoFn,
  audioSegmentTimingInfoFn,
  id3Fn,
  captionsFn,
  isEndOfTimeline,
  endedTimelineFn,
  dataFn,
  doneFn,
  onTransmuxerLog
}) => {
  decrypt({
    id: segment.requestId,
    key: segment.key,
    encryptedBytes: segment.encryptedBytes,
    decryptionWorker
  }, decryptedBytes => {
    segment.bytes = decryptedBytes;
    handleSegmentBytes({
      segment,
      bytes: segment.bytes,
      trackInfoFn,
      timingInfoFn,
      videoSegmentTimingInfoFn,
      audioSegmentTimingInfoFn,
      id3Fn,
      captionsFn,
      isEndOfTimeline,
      endedTimelineFn,
      dataFn,
      doneFn,
      onTransmuxerLog
    });
  });
};
/**
 * This function waits for all XHRs to finish (with either success or failure)
 * before continueing processing via it's callback. The function gathers errors
 * from each request into a single errors array so that the error status for
 * each request can be examined later.
 *
 * @param {Object} activeXhrs - an object that tracks all XHR requests
 * @param {WebWorker} decryptionWorker - a WebWorker interface to AES-128 decryption
 *                                       routines
 * @param {Function} trackInfoFn - a callback that receives track info
 * @param {Function} timingInfoFn - a callback that receives timing info
 * @param {Function} videoSegmentTimingInfoFn
 *                   a callback that receives video timing info based on media times and
 *                   any adjustments made by the transmuxer
 * @param {Function} audioSegmentTimingInfoFn
 *                   a callback that receives audio timing info based on media times and
 *                   any adjustments made by the transmuxer
 * @param {Function} id3Fn - a callback that receives ID3 metadata
 * @param {Function} captionsFn - a callback that receives captions
 * @param {boolean}  isEndOfTimeline
 *                   true if this segment represents the last segment in a timeline
 * @param {Function} endedTimelineFn
 *                   a callback made when a timeline is ended, will only be called if
 *                   isEndOfTimeline is true
 * @param {Function} dataFn - a callback that is executed when segment bytes are available
 *                            and ready to use
 * @param {Function} doneFn - a callback that is executed after all resources have been
 *                            downloaded and any decryption completed
 */


const waitForCompletion = ({
  activeXhrs,
  decryptionWorker,
  trackInfoFn,
  timingInfoFn,
  videoSegmentTimingInfoFn,
  audioSegmentTimingInfoFn,
  id3Fn,
  captionsFn,
  isEndOfTimeline,
  endedTimelineFn,
  dataFn,
  doneFn,
  onTransmuxerLog
}) => {
  let count = 0;
  let didError = false;
  return (error, segment) => {
    if (didError) {
      return;
    }

    if (error) {
      didError = true; // If there are errors, we have to abort any outstanding requests

      abortAll(activeXhrs); // Even though the requests above are aborted, and in theory we could wait until we
      // handle the aborted events from those requests, there are some cases where we may
      // never get an aborted event. For instance, if the network connection is lost and
      // there were two requests, the first may have triggered an error immediately, while
      // the second request remains unsent. In that case, the aborted algorithm will not
      // trigger an abort: see https://xhr.spec.whatwg.org/#the-abort()-method
      //
      // We also can't rely on the ready state of the XHR, since the request that
      // triggered the connection error may also show as a ready state of 0 (unsent).
      // Therefore, we have to finish this group of requests immediately after the first
      // seen error.

      return doneFn(error, segment);
    }

    count += 1;

    if (count === activeXhrs.length) {
      const segmentFinish = function () {
        if (segment.encryptedBytes) {
          return decryptSegment({
            decryptionWorker,
            segment,
            trackInfoFn,
            timingInfoFn,
            videoSegmentTimingInfoFn,
            audioSegmentTimingInfoFn,
            id3Fn,
            captionsFn,
            isEndOfTimeline,
            endedTimelineFn,
            dataFn,
            doneFn,
            onTransmuxerLog
          });
        } // Otherwise, everything is ready just continue


        handleSegmentBytes({
          segment,
          bytes: segment.bytes,
          trackInfoFn,
          timingInfoFn,
          videoSegmentTimingInfoFn,
          audioSegmentTimingInfoFn,
          id3Fn,
          captionsFn,
          isEndOfTimeline,
          endedTimelineFn,
          dataFn,
          doneFn,
          onTransmuxerLog
        });
      }; // Keep track of when *all* of the requests have completed


      segment.endOfAllRequests = Date.now();

      if (segment.map && segment.map.encryptedBytes && !segment.map.bytes) {
        return decrypt({
          decryptionWorker,
          // add -init to the "id" to differentiate between segment
          // and init segment decryption, just in case they happen
          // at the same time at some point in the future.
          id: segment.requestId + '-init',
          encryptedBytes: segment.map.encryptedBytes,
          key: segment.map.key
        }, decryptedBytes => {
          segment.map.bytes = decryptedBytes;
          parseInitSegment(segment, parseError => {
            if (parseError) {
              abortAll(activeXhrs);
              return doneFn(parseError, segment);
            }

            segmentFinish();
          });
        });
      }

      segmentFinish();
    }
  };
};
/**
 * Calls the abort callback if any request within the batch was aborted. Will only call
 * the callback once per batch of requests, even if multiple were aborted.
 *
 * @param {Object} loadendState - state to check to see if the abort function was called
 * @param {Function} abortFn - callback to call for abort
 */


const handleLoadEnd = ({
  loadendState,
  abortFn
}) => event => {
  const request = event.target;

  if (request.aborted && abortFn && !loadendState.calledAbortFn) {
    abortFn();
    loadendState.calledAbortFn = true;
  }
};
/**
 * Simple progress event callback handler that gathers some stats before
 * executing a provided callback with the `segment` object
 *
 * @param {Object} segment - a simplified copy of the segmentInfo object
 *                           from SegmentLoader
 * @param {Function} progressFn - a callback that is executed each time a progress event
 *                                is received
 * @param {Function} trackInfoFn - a callback that receives track info
 * @param {Function} timingInfoFn - a callback that receives timing info
 * @param {Function} videoSegmentTimingInfoFn
 *                   a callback that receives video timing info based on media times and
 *                   any adjustments made by the transmuxer
 * @param {Function} audioSegmentTimingInfoFn
 *                   a callback that receives audio timing info based on media times and
 *                   any adjustments made by the transmuxer
 * @param {boolean}  isEndOfTimeline
 *                   true if this segment represents the last segment in a timeline
 * @param {Function} endedTimelineFn
 *                   a callback made when a timeline is ended, will only be called if
 *                   isEndOfTimeline is true
 * @param {Function} dataFn - a callback that is executed when segment bytes are available
 *                            and ready to use
 * @param {Event} event - the progress event object from XMLHttpRequest
 */


const handleProgress = ({
  segment,
  progressFn,
  trackInfoFn,
  timingInfoFn,
  videoSegmentTimingInfoFn,
  audioSegmentTimingInfoFn,
  id3Fn,
  captionsFn,
  isEndOfTimeline,
  endedTimelineFn,
  dataFn
}) => event => {
  const request = event.target;

  if (request.aborted) {
    return;
  }

  segment.stats = merge(segment.stats, getProgressStats(event)); // record the time that we receive the first byte of data

  if (!segment.stats.firstBytesReceivedAt && segment.stats.bytesReceived) {
    segment.stats.firstBytesReceivedAt = Date.now();
  }

  return progressFn(event, segment);
};
/**
 * Load all resources and does any processing necessary for a media-segment
 *
 * Features:
 *   decrypts the media-segment if it has a key uri and an iv
 *   aborts *all* requests if *any* one request fails
 *
 * The segment object, at minimum, has the following format:
 * {
 *   resolvedUri: String,
 *   [transmuxer]: Object,
 *   [byterange]: {
 *     offset: Number,
 *     length: Number
 *   },
 *   [key]: {
 *     resolvedUri: String
 *     [byterange]: {
 *       offset: Number,
 *       length: Number
 *     },
 *     iv: {
 *       bytes: Uint32Array
 *     }
 *   },
 *   [map]: {
 *     resolvedUri: String,
 *     [byterange]: {
 *       offset: Number,
 *       length: Number
 *     },
 *     [bytes]: Uint8Array
 *   }
 * }
 * ...where [name] denotes optional properties
 *
 * @param {Function} xhr - an instance of the xhr wrapper in xhr.js
 * @param {Object} xhrOptions - the base options to provide to all xhr requests
 * @param {WebWorker} decryptionWorker - a WebWorker interface to AES-128
 *                                       decryption routines
 * @param {Object} segment - a simplified copy of the segmentInfo object
 *                           from SegmentLoader
 * @param {Function} abortFn - a callback called (only once) if any piece of a request was
 *                             aborted
 * @param {Function} progressFn - a callback that receives progress events from the main
 *                                segment's xhr request
 * @param {Function} trackInfoFn - a callback that receives track info
 * @param {Function} timingInfoFn - a callback that receives timing info
 * @param {Function} videoSegmentTimingInfoFn
 *                   a callback that receives video timing info based on media times and
 *                   any adjustments made by the transmuxer
 * @param {Function} audioSegmentTimingInfoFn
 *                   a callback that receives audio timing info based on media times and
 *                   any adjustments made by the transmuxer
 * @param {Function} id3Fn - a callback that receives ID3 metadata
 * @param {Function} captionsFn - a callback that receives captions
 * @param {boolean}  isEndOfTimeline
 *                   true if this segment represents the last segment in a timeline
 * @param {Function} endedTimelineFn
 *                   a callback made when a timeline is ended, will only be called if
 *                   isEndOfTimeline is true
 * @param {Function} dataFn - a callback that receives data from the main segment's xhr
 *                            request, transmuxed if needed
 * @param {Function} doneFn - a callback that is executed only once all requests have
 *                            succeeded or failed
 * @return {Function} a function that, when invoked, immediately aborts all
 *                     outstanding requests
 */


const mediaSegmentRequest = ({
  xhr,
  xhrOptions,
  decryptionWorker,
  segment,
  abortFn,
  progressFn,
  trackInfoFn,
  timingInfoFn,
  videoSegmentTimingInfoFn,
  audioSegmentTimingInfoFn,
  id3Fn,
  captionsFn,
  isEndOfTimeline,
  endedTimelineFn,
  dataFn,
  doneFn,
  onTransmuxerLog
}) => {
  const activeXhrs = [];
  const finishProcessingFn = waitForCompletion({
    activeXhrs,
    decryptionWorker,
    trackInfoFn,
    timingInfoFn,
    videoSegmentTimingInfoFn,
    audioSegmentTimingInfoFn,
    id3Fn,
    captionsFn,
    isEndOfTimeline,
    endedTimelineFn,
    dataFn,
    doneFn,
    onTransmuxerLog
  }); // optionally, request the decryption key

  if (segment.key && !segment.key.bytes) {
    const objects = [segment.key];

    if (segment.map && !segment.map.bytes && segment.map.key && segment.map.key.resolvedUri === segment.key.resolvedUri) {
      objects.push(segment.map.key);
    }

    const keyRequestOptions = merge(xhrOptions, {
      uri: segment.key.resolvedUri,
      responseType: 'arraybuffer'
    });
    const keyRequestCallback = handleKeyResponse(segment, objects, finishProcessingFn);
    const keyXhr = xhr(keyRequestOptions, keyRequestCallback);
    activeXhrs.push(keyXhr);
  } // optionally, request the associated media init segment


  if (segment.map && !segment.map.bytes) {
    const differentMapKey = segment.map.key && (!segment.key || segment.key.resolvedUri !== segment.map.key.resolvedUri);

    if (differentMapKey) {
      const mapKeyRequestOptions = merge(xhrOptions, {
        uri: segment.map.key.resolvedUri,
        responseType: 'arraybuffer'
      });
      const mapKeyRequestCallback = handleKeyResponse(segment, [segment.map.key], finishProcessingFn);
      const mapKeyXhr = xhr(mapKeyRequestOptions, mapKeyRequestCallback);
      activeXhrs.push(mapKeyXhr);
    }

    const initSegmentOptions = merge(xhrOptions, {
      uri: segment.map.resolvedUri,
      responseType: 'arraybuffer',
      headers: segmentXhrHeaders(segment.map)
    });
    const initSegmentRequestCallback = handleInitSegmentResponse({
      segment,
      finishProcessingFn
    });
    const initSegmentXhr = xhr(initSegmentOptions, initSegmentRequestCallback);
    activeXhrs.push(initSegmentXhr);
  }

  const segmentRequestOptions = merge(xhrOptions, {
    uri: segment.part && segment.part.resolvedUri || segment.resolvedUri,
    responseType: 'arraybuffer',
    headers: segmentXhrHeaders(segment)
  });
  const segmentRequestCallback = handleSegmentResponse({
    segment,
    finishProcessingFn,
    responseType: segmentRequestOptions.responseType
  });
  const segmentXhr = xhr(segmentRequestOptions, segmentRequestCallback);
  segmentXhr.addEventListener('progress', handleProgress({
    segment,
    progressFn,
    trackInfoFn,
    timingInfoFn,
    videoSegmentTimingInfoFn,
    audioSegmentTimingInfoFn,
    id3Fn,
    captionsFn,
    isEndOfTimeline,
    endedTimelineFn,
    dataFn
  }));
  activeXhrs.push(segmentXhr); // since all parts of the request must be considered, but should not make callbacks
  // multiple times, provide a shared state object

  const loadendState = {};
  activeXhrs.forEach(activeXhr => {
    activeXhr.addEventListener('loadend', handleLoadEnd({
      loadendState,
      abortFn
    }));
  });
  return () => abortAll(activeXhrs);
};

/**
 * @file - codecs.js - Handles tasks regarding codec strings such as translating them to
 * codec strings, or translating codec strings into objects that can be examined.
 */
const logFn$1 = logger('CodecUtils');
/**
 * Returns a set of codec strings parsed from the playlist or the default
 * codec strings if no codecs were specified in the playlist
 *
 * @param {Playlist} media the current media playlist
 * @return {Object} an object with the video and audio codecs
 */

const getCodecs = function (media) {
  // if the codecs were explicitly specified, use them instead of the
  // defaults
  const mediaAttributes = media.attributes || {};

  if (mediaAttributes.CODECS) {
    return parseCodecs(mediaAttributes.CODECS);
  }
};

const isMaat = (main, media) => {
  const mediaAttributes = media.attributes || {};
  return main && main.mediaGroups && main.mediaGroups.AUDIO && mediaAttributes.AUDIO && main.mediaGroups.AUDIO[mediaAttributes.AUDIO];
};
const isMuxed = (main, media) => {
  if (!isMaat(main, media)) {
    return true;
  }

  const mediaAttributes = media.attributes || {};
  const audioGroup = main.mediaGroups.AUDIO[mediaAttributes.AUDIO];

  for (const groupId in audioGroup) {
    // If an audio group has a URI (the case for HLS, as HLS will use external playlists),
    // or there are listed playlists (the case for DASH, as the manifest will have already
    // provided all of the details necessary to generate the audio playlist, as opposed to
    // HLS' externally requested playlists), then the content is demuxed.
    if (!audioGroup[groupId].uri && !audioGroup[groupId].playlists) {
      return true;
    }
  }

  return false;
};
const unwrapCodecList = function (codecList) {
  const codecs = {};
  codecList.forEach(({
    mediaType,
    type,
    details
  }) => {
    codecs[mediaType] = codecs[mediaType] || [];
    codecs[mediaType].push(translateLegacyCodec(`${type}${details}`));
  });
  Object.keys(codecs).forEach(function (mediaType) {
    if (codecs[mediaType].length > 1) {
      logFn$1(`multiple ${mediaType} codecs found as attributes: ${codecs[mediaType].join(', ')}. Setting playlist codecs to null so that we wait for mux.js to probe segments for real codecs.`);
      codecs[mediaType] = null;
      return;
    }

    codecs[mediaType] = codecs[mediaType][0];
  });
  return codecs;
};
const codecCount = function (codecObj) {
  let count = 0;

  if (codecObj.audio) {
    count++;
  }

  if (codecObj.video) {
    count++;
  }

  return count;
};
/**
 * Calculates the codec strings for a working configuration of
 * SourceBuffers to play variant streams in a main playlist. If
 * there is no possible working configuration, an empty object will be
 * returned.
 *
 * @param main {Object} the m3u8 object for the main playlist
 * @param media {Object} the m3u8 object for the variant playlist
 * @return {Object} the codec strings.
 *
 * @private
 */

const codecsForPlaylist = function (main, media) {
  const mediaAttributes = media.attributes || {};
  const codecInfo = unwrapCodecList(getCodecs(media) || []); // HLS with multiple-audio tracks must always get an audio codec.
  // Put another way, there is no way to have a video-only multiple-audio HLS!

  if (isMaat(main, media) && !codecInfo.audio) {
    if (!isMuxed(main, media)) {
      // It is possible for codecs to be specified on the audio media group playlist but
      // not on the rendition playlist. This is mostly the case for DASH, where audio and
      // video are always separate (and separately specified).
      const defaultCodecs = unwrapCodecList(codecsFromDefault(main, mediaAttributes.AUDIO) || []);

      if (defaultCodecs.audio) {
        codecInfo.audio = defaultCodecs.audio;
      }
    }
  }

  return codecInfo;
};

const logFn = logger('PlaylistSelector');

const representationToString = function (representation) {
  if (!representation || !representation.playlist) {
    return;
  }

  const playlist = representation.playlist;
  return JSON.stringify({
    id: playlist.id,
    bandwidth: representation.bandwidth,
    width: representation.width,
    height: representation.height,
    codecs: playlist.attributes && playlist.attributes.CODECS || ''
  });
}; // Utilities

/**
 * Returns the CSS value for the specified property on an element
 * using `getComputedStyle`. Firefox has a long-standing issue where
 * getComputedStyle() may return null when running in an iframe with
 * `display: none`.
 *
 * @see https://bugzilla.mozilla.org/show_bug.cgi?id=548397
 * @param {HTMLElement} el the htmlelement to work on
 * @param {string} the proprety to get the style for
 */


const safeGetComputedStyle = function (el, property) {
  if (!el) {
    return '';
  }

  const result = window$1.getComputedStyle(el);

  if (!result) {
    return '';
  }

  return result[property];
};
/**
 * Resuable stable sort function
 *
 * @param {Playlists} array
 * @param {Function} sortFn Different comparators
 * @function stableSort
 */


const stableSort = function (array, sortFn) {
  const newArray = array.slice();
  array.sort(function (left, right) {
    const cmp = sortFn(left, right);

    if (cmp === 0) {
      return newArray.indexOf(left) - newArray.indexOf(right);
    }

    return cmp;
  });
};
/**
 * A comparator function to sort two playlist object by bandwidth.
 *
 * @param {Object} left a media playlist object
 * @param {Object} right a media playlist object
 * @return {number} Greater than zero if the bandwidth attribute of
 * left is greater than the corresponding attribute of right. Less
 * than zero if the bandwidth of right is greater than left and
 * exactly zero if the two are equal.
 */


const comparePlaylistBandwidth = function (left, right) {
  let leftBandwidth;
  let rightBandwidth;

  if (left.attributes.BANDWIDTH) {
    leftBandwidth = left.attributes.BANDWIDTH;
  }

  leftBandwidth = leftBandwidth || window$1.Number.MAX_VALUE;

  if (right.attributes.BANDWIDTH) {
    rightBandwidth = right.attributes.BANDWIDTH;
  }

  rightBandwidth = rightBandwidth || window$1.Number.MAX_VALUE;
  return leftBandwidth - rightBandwidth;
};
/**
 * A comparator function to sort two playlist object by resolution (width).
 *
 * @param {Object} left a media playlist object
 * @param {Object} right a media playlist object
 * @return {number} Greater than zero if the resolution.width attribute of
 * left is greater than the corresponding attribute of right. Less
 * than zero if the resolution.width of right is greater than left and
 * exactly zero if the two are equal.
 */

const comparePlaylistResolution = function (left, right) {
  let leftWidth;
  let rightWidth;

  if (left.attributes.RESOLUTION && left.attributes.RESOLUTION.width) {
    leftWidth = left.attributes.RESOLUTION.width;
  }

  leftWidth = leftWidth || window$1.Number.MAX_VALUE;

  if (right.attributes.RESOLUTION && right.attributes.RESOLUTION.width) {
    rightWidth = right.attributes.RESOLUTION.width;
  }

  rightWidth = rightWidth || window$1.Number.MAX_VALUE; // NOTE - Fallback to bandwidth sort as appropriate in cases where multiple renditions
  // have the same media dimensions/ resolution

  if (leftWidth === rightWidth && left.attributes.BANDWIDTH && right.attributes.BANDWIDTH) {
    return left.attributes.BANDWIDTH - right.attributes.BANDWIDTH;
  }

  return leftWidth - rightWidth;
};
/**
 * Chooses the appropriate media playlist based on bandwidth and player size
 *
 * @param {Object} main
 *        Object representation of the main manifest
 * @param {number} playerBandwidth
 *        Current calculated bandwidth of the player
 * @param {number} playerWidth
 *        Current width of the player element (should account for the device pixel ratio)
 * @param {number} playerHeight
 *        Current height of the player element (should account for the device pixel ratio)
 * @param {boolean} limitRenditionByPlayerDimensions
 *        True if the player width and height should be used during the selection, false otherwise
 * @param {Object} playlistController
 *        the current playlistController object
 * @return {Playlist} the highest bitrate playlist less than the
 * currently detected bandwidth, accounting for some amount of
 * bandwidth variance
 */

let simpleSelector = function (main, playerBandwidth, playerWidth, playerHeight, limitRenditionByPlayerDimensions, playlistController) {
  // If we end up getting called before `main` is available, exit early
  if (!main) {
    return;
  }

  const options = {
    bandwidth: playerBandwidth,
    width: playerWidth,
    height: playerHeight,
    limitRenditionByPlayerDimensions
  };
  let playlists = main.playlists; // if playlist is audio only, select between currently active audio group playlists.

  if (Playlist.isAudioOnly(main)) {
    playlists = playlistController.getAudioTrackPlaylists_(); // add audioOnly to options so that we log audioOnly: true
    // at the buttom of this function for debugging.

    options.audioOnly = true;
  } // convert the playlists to an intermediary representation to make comparisons easier


  let sortedPlaylistReps = playlists.map(playlist => {
    let bandwidth;
    const width = playlist.attributes && playlist.attributes.RESOLUTION && playlist.attributes.RESOLUTION.width;
    const height = playlist.attributes && playlist.attributes.RESOLUTION && playlist.attributes.RESOLUTION.height;
    bandwidth = playlist.attributes && playlist.attributes.BANDWIDTH;
    bandwidth = bandwidth || window$1.Number.MAX_VALUE;
    return {
      bandwidth,
      width,
      height,
      playlist
    };
  });
  stableSort(sortedPlaylistReps, (left, right) => left.bandwidth - right.bandwidth); // filter out any playlists that have been excluded due to
  // incompatible configurations

  sortedPlaylistReps = sortedPlaylistReps.filter(rep => !Playlist.isIncompatible(rep.playlist)); // filter out any playlists that have been disabled manually through the representations
  // api or excluded temporarily due to playback errors.

  let enabledPlaylistReps = sortedPlaylistReps.filter(rep => Playlist.isEnabled(rep.playlist));

  if (!enabledPlaylistReps.length) {
    // if there are no enabled playlists, then they have all been excluded or disabled
    // by the user through the representations api. In this case, ignore exclusion and
    // fallback to what the user wants by using playlists the user has not disabled.
    enabledPlaylistReps = sortedPlaylistReps.filter(rep => !Playlist.isDisabled(rep.playlist));
  } // filter out any variant that has greater effective bitrate
  // than the current estimated bandwidth


  const bandwidthPlaylistReps = enabledPlaylistReps.filter(rep => rep.bandwidth * Config.BANDWIDTH_VARIANCE < playerBandwidth);
  let highestRemainingBandwidthRep = bandwidthPlaylistReps[bandwidthPlaylistReps.length - 1]; // get all of the renditions with the same (highest) bandwidth
  // and then taking the very first element

  const bandwidthBestRep = bandwidthPlaylistReps.filter(rep => rep.bandwidth === highestRemainingBandwidthRep.bandwidth)[0]; // if we're not going to limit renditions by player size, make an early decision.

  if (limitRenditionByPlayerDimensions === false) {
    const chosenRep = bandwidthBestRep || enabledPlaylistReps[0] || sortedPlaylistReps[0];

    if (chosenRep && chosenRep.playlist) {
      let type = 'sortedPlaylistReps';

      if (bandwidthBestRep) {
        type = 'bandwidthBestRep';
      }

      if (enabledPlaylistReps[0]) {
        type = 'enabledPlaylistReps';
      }

      logFn(`choosing ${representationToString(chosenRep)} using ${type} with options`, options);
      return chosenRep.playlist;
    }

    logFn('could not choose a playlist with options', options);
    return null;
  } // filter out playlists without resolution information


  const haveResolution = bandwidthPlaylistReps.filter(rep => rep.width && rep.height); // sort variants by resolution

  stableSort(haveResolution, (left, right) => left.width - right.width); // if we have the exact resolution as the player use it

  const resolutionBestRepList = haveResolution.filter(rep => rep.width === playerWidth && rep.height === playerHeight);
  highestRemainingBandwidthRep = resolutionBestRepList[resolutionBestRepList.length - 1]; // ensure that we pick the highest bandwidth variant that have exact resolution

  const resolutionBestRep = resolutionBestRepList.filter(rep => rep.bandwidth === highestRemainingBandwidthRep.bandwidth)[0];
  let resolutionPlusOneList;
  let resolutionPlusOneSmallest;
  let resolutionPlusOneRep; // find the smallest variant that is larger than the player
  // if there is no match of exact resolution

  if (!resolutionBestRep) {
    resolutionPlusOneList = haveResolution.filter(rep => rep.width > playerWidth || rep.height > playerHeight); // find all the variants have the same smallest resolution

    resolutionPlusOneSmallest = resolutionPlusOneList.filter(rep => rep.width === resolutionPlusOneList[0].width && rep.height === resolutionPlusOneList[0].height); // ensure that we also pick the highest bandwidth variant that
    // is just-larger-than the video player

    highestRemainingBandwidthRep = resolutionPlusOneSmallest[resolutionPlusOneSmallest.length - 1];
    resolutionPlusOneRep = resolutionPlusOneSmallest.filter(rep => rep.bandwidth === highestRemainingBandwidthRep.bandwidth)[0];
  }

  let leastPixelDiffRep; // If this selector proves to be better than others,
  // resolutionPlusOneRep and resolutionBestRep and all
  // the code involving them should be removed.

  if (playlistController.leastPixelDiffSelector) {
    // find the variant that is closest to the player's pixel size
    const leastPixelDiffList = haveResolution.map(rep => {
      rep.pixelDiff = Math.abs(rep.width - playerWidth) + Math.abs(rep.height - playerHeight);
      return rep;
    }); // get the highest bandwidth, closest resolution playlist

    stableSort(leastPixelDiffList, (left, right) => {
      // sort by highest bandwidth if pixelDiff is the same
      if (left.pixelDiff === right.pixelDiff) {
        return right.bandwidth - left.bandwidth;
      }

      return left.pixelDiff - right.pixelDiff;
    });
    leastPixelDiffRep = leastPixelDiffList[0];
  } // fallback chain of variants


  const chosenRep = leastPixelDiffRep || resolutionPlusOneRep || resolutionBestRep || bandwidthBestRep || enabledPlaylistReps[0] || sortedPlaylistReps[0];

  if (chosenRep && chosenRep.playlist) {
    let type = 'sortedPlaylistReps';

    if (leastPixelDiffRep) {
      type = 'leastPixelDiffRep';
    } else if (resolutionPlusOneRep) {
      type = 'resolutionPlusOneRep';
    } else if (resolutionBestRep) {
      type = 'resolutionBestRep';
    } else if (bandwidthBestRep) {
      type = 'bandwidthBestRep';
    } else if (enabledPlaylistReps[0]) {
      type = 'enabledPlaylistReps';
    }

    logFn(`choosing ${representationToString(chosenRep)} using ${type} with options`, options);
    return chosenRep.playlist;
  }

  logFn('could not choose a playlist with options', options);
  return null;
};

/**
 * Chooses the appropriate media playlist based on the most recent
 * bandwidth estimate and the player size.
 *
 * Expects to be called within the context of an instance of VhsHandler
 *
 * @return {Playlist} the highest bitrate playlist less than the
 * currently detected bandwidth, accounting for some amount of
 * bandwidth variance
 */

const lastBandwidthSelector = function () {
  const pixelRatio = this.useDevicePixelRatio ? window$1.devicePixelRatio || 1 : 1;
  return simpleSelector(this.playlists.main, this.systemBandwidth, parseInt(safeGetComputedStyle(this.tech_.el(), 'width'), 10) * pixelRatio, parseInt(safeGetComputedStyle(this.tech_.el(), 'height'), 10) * pixelRatio, this.limitRenditionByPlayerDimensions, this.playlistController_);
};
/**
 * Chooses the appropriate media playlist based on an
 * exponential-weighted moving average of the bandwidth after
 * filtering for player size.
 *
 * Expects to be called within the context of an instance of VhsHandler
 *
 * @param {number} decay - a number between 0 and 1. Higher values of
 * this parameter will cause previous bandwidth estimates to lose
 * significance more quickly.
 * @return {Function} a function which can be invoked to create a new
 * playlist selector function.
 * @see https://en.wikipedia.org/wiki/Moving_average#Exponential_moving_average
 */

const movingAverageBandwidthSelector = function (decay) {
  let average = -1;
  let lastSystemBandwidth = -1;

  if (decay < 0 || decay > 1) {
    throw new Error('Moving average bandwidth decay must be between 0 and 1.');
  }

  return function () {
    const pixelRatio = this.useDevicePixelRatio ? window$1.devicePixelRatio || 1 : 1;

    if (average < 0) {
      average = this.systemBandwidth;
      lastSystemBandwidth = this.systemBandwidth;
    } // stop the average value from decaying for every 250ms
    // when the systemBandwidth is constant
    // and
    // stop average from setting to a very low value when the
    // systemBandwidth becomes 0 in case of chunk cancellation


    if (this.systemBandwidth > 0 && this.systemBandwidth !== lastSystemBandwidth) {
      average = decay * this.systemBandwidth + (1 - decay) * average;
      lastSystemBandwidth = this.systemBandwidth;
    }

    return simpleSelector(this.playlists.main, average, parseInt(safeGetComputedStyle(this.tech_.el(), 'width'), 10) * pixelRatio, parseInt(safeGetComputedStyle(this.tech_.el(), 'height'), 10) * pixelRatio, this.limitRenditionByPlayerDimensions, this.playlistController_);
  };
};
/**
 * Chooses the appropriate media playlist based on the potential to rebuffer
 *
 * @param {Object} settings
 *        Object of information required to use this selector
 * @param {Object} settings.main
 *        Object representation of the main manifest
 * @param {number} settings.currentTime
 *        The current time of the player
 * @param {number} settings.bandwidth
 *        Current measured bandwidth
 * @param {number} settings.duration
 *        Duration of the media
 * @param {number} settings.segmentDuration
 *        Segment duration to be used in round trip time calculations
 * @param {number} settings.timeUntilRebuffer
 *        Time left in seconds until the player has to rebuffer
 * @param {number} settings.currentTimeline
 *        The current timeline segments are being loaded from
 * @param {SyncController} settings.syncController
 *        SyncController for determining if we have a sync point for a given playlist
 * @return {Object|null}
 *         {Object} return.playlist
 *         The highest bandwidth playlist with the least amount of rebuffering
 *         {Number} return.rebufferingImpact
 *         The amount of time in seconds switching to this playlist will rebuffer. A
 *         negative value means that switching will cause zero rebuffering.
 */

const minRebufferMaxBandwidthSelector = function (settings) {
  const {
    main,
    currentTime,
    bandwidth,
    duration,
    segmentDuration,
    timeUntilRebuffer,
    currentTimeline,
    syncController
  } = settings; // filter out any playlists that have been excluded due to
  // incompatible configurations

  const compatiblePlaylists = main.playlists.filter(playlist => !Playlist.isIncompatible(playlist)); // filter out any playlists that have been disabled manually through the representations
  // api or excluded temporarily due to playback errors.

  let enabledPlaylists = compatiblePlaylists.filter(Playlist.isEnabled);

  if (!enabledPlaylists.length) {
    // if there are no enabled playlists, then they have all been excluded or disabled
    // by the user through the representations api. In this case, ignore exclusion and
    // fallback to what the user wants by using playlists the user has not disabled.
    enabledPlaylists = compatiblePlaylists.filter(playlist => !Playlist.isDisabled(playlist));
  }

  const bandwidthPlaylists = enabledPlaylists.filter(Playlist.hasAttribute.bind(null, 'BANDWIDTH'));
  const rebufferingEstimates = bandwidthPlaylists.map(playlist => {
    const syncPoint = syncController.getSyncPoint(playlist, duration, currentTimeline, currentTime); // If there is no sync point for this playlist, switching to it will require a
    // sync request first. This will double the request time

    const numRequests = syncPoint ? 1 : 2;
    const requestTimeEstimate = Playlist.estimateSegmentRequestTime(segmentDuration, bandwidth, playlist);
    const rebufferingImpact = requestTimeEstimate * numRequests - timeUntilRebuffer;
    return {
      playlist,
      rebufferingImpact
    };
  });
  const noRebufferingPlaylists = rebufferingEstimates.filter(estimate => estimate.rebufferingImpact <= 0); // Sort by bandwidth DESC

  stableSort(noRebufferingPlaylists, (a, b) => comparePlaylistBandwidth(b.playlist, a.playlist));

  if (noRebufferingPlaylists.length) {
    return noRebufferingPlaylists[0];
  }

  stableSort(rebufferingEstimates, (a, b) => a.rebufferingImpact - b.rebufferingImpact);
  return rebufferingEstimates[0] || null;
};
/**
 * Chooses the appropriate media playlist, which in this case is the lowest bitrate
 * one with video.  If no renditions with video exist, return the lowest audio rendition.
 *
 * Expects to be called within the context of an instance of VhsHandler
 *
 * @return {Object|null}
 *         {Object} return.playlist
 *         The lowest bitrate playlist that contains a video codec.  If no such rendition
 *         exists pick the lowest audio rendition.
 */

const lowestBitrateCompatibleVariantSelector = function () {
  // filter out any playlists that have been excluded due to
  // incompatible configurations or playback errors
  const playlists = this.playlists.main.playlists.filter(Playlist.isEnabled); // Sort ascending by bitrate

  stableSort(playlists, (a, b) => comparePlaylistBandwidth(a, b)); // Parse and assume that playlists with no video codec have no video
  // (this is not necessarily true, although it is generally true).
  //
  // If an entire manifest has no valid videos everything will get filtered
  // out.

  const playlistsWithVideo = playlists.filter(playlist => !!codecsForPlaylist(this.playlists.main, playlist).video);
  return playlistsWithVideo[0] || null;
};

/**
 * Combine all segments into a single Uint8Array
 *
 * @param {Object} segmentObj
 * @return {Uint8Array} concatenated bytes
 * @private
 */
const concatSegments = segmentObj => {
  let offset = 0;
  let tempBuffer;

  if (segmentObj.bytes) {
    tempBuffer = new Uint8Array(segmentObj.bytes); // combine the individual segments into one large typed-array

    segmentObj.segments.forEach(segment => {
      tempBuffer.set(segment, offset);
      offset += segment.byteLength;
    });
  }

  return tempBuffer;
};

/**
 * @file text-tracks.js
 */
/**
 * Create captions text tracks on video.js if they do not exist
 *
 * @param {Object} inbandTextTracks a reference to current inbandTextTracks
 * @param {Object} tech the video.js tech
 * @param {Object} captionStream the caption stream to create
 * @private
 */

const createCaptionsTrackIfNotExists = function (inbandTextTracks, tech, captionStream) {
  if (!inbandTextTracks[captionStream]) {
    tech.trigger({
      type: 'usage',
      name: 'vhs-608'
    });
    let instreamId = captionStream; // we need to translate SERVICEn for 708 to how mux.js currently labels them

    if (/^cc708_/.test(captionStream)) {
      instreamId = 'SERVICE' + captionStream.split('_')[1];
    }

    const track = tech.textTracks().getTrackById(instreamId);

    if (track) {
      // Resuse an existing track with a CC# id because this was
      // very likely created by videojs-contrib-hls from information
      // in the m3u8 for us to use
      inbandTextTracks[captionStream] = track;
    } else {
      // This section gets called when we have caption services that aren't specified in the manifest.
      // Manifest level caption services are handled in media-groups.js under CLOSED-CAPTIONS.
      const captionServices = tech.options_.vhs && tech.options_.vhs.captionServices || {};
      let label = captionStream;
      let language = captionStream;
      let def = false;
      const captionService = captionServices[instreamId];

      if (captionService) {
        label = captionService.label;
        language = captionService.language;
        def = captionService.default;
      } // Otherwise, create a track with the default `CC#` label and
      // without a language


      inbandTextTracks[captionStream] = tech.addRemoteTextTrack({
        kind: 'captions',
        id: instreamId,
        // TODO: investigate why this doesn't seem to turn the caption on by default
        default: def,
        label,
        language
      }, false).track;
    }
  }
};
/**
 * Add caption text track data to a source handler given an array of captions
 *
 * @param {Object}
 *   @param {Object} inbandTextTracks the inband text tracks
 *   @param {number} timestampOffset the timestamp offset of the source buffer
 *   @param {Array} captionArray an array of caption data
 * @private
 */

const addCaptionData = function ({
  inbandTextTracks,
  captionArray,
  timestampOffset
}) {
  if (!captionArray) {
    return;
  }

  const Cue = window$1.WebKitDataCue || window$1.VTTCue;
  captionArray.forEach(caption => {
    const track = caption.stream; // in CEA 608 captions, video.js/mux.js sends a content array
    // with positioning data

    if (caption.content) {
      caption.content.forEach(value => {
        const cue = new Cue(caption.startTime + timestampOffset, caption.endTime + timestampOffset, value.text);
        cue.line = value.line;
        cue.align = 'left';
        cue.position = value.position;
        cue.positionAlign = 'line-left';
        inbandTextTracks[track].addCue(cue);
      });
    } else {
      // otherwise, a text value with combined captions is sent
      inbandTextTracks[track].addCue(new Cue(caption.startTime + timestampOffset, caption.endTime + timestampOffset, caption.text));
    }
  });
};
/**
 * Define properties on a cue for backwards compatability,
 * but warn the user that the way that they are using it
 * is depricated and will be removed at a later date.
 *
 * @param {Cue} cue the cue to add the properties on
 * @private
 */

const deprecateOldCue = function (cue) {
  Object.defineProperties(cue.frame, {
    id: {
      get() {
        videojs.log.warn('cue.frame.id is deprecated. Use cue.value.key instead.');
        return cue.value.key;
      }

    },
    value: {
      get() {
        videojs.log.warn('cue.frame.value is deprecated. Use cue.value.data instead.');
        return cue.value.data;
      }

    },
    privateData: {
      get() {
        videojs.log.warn('cue.frame.privateData is deprecated. Use cue.value.data instead.');
        return cue.value.data;
      }

    }
  });
};
/**
 * Add metadata text track data to a source handler given an array of metadata
 *
 * @param {Object}
 *   @param {Object} inbandTextTracks the inband text tracks
 *   @param {Array} metadataArray an array of meta data
 *   @param {number} timestampOffset the timestamp offset of the source buffer
 *   @param {number} videoDuration the duration of the video
 * @private
 */


const addMetadata = ({
  inbandTextTracks,
  metadataArray,
  timestampOffset,
  videoDuration
}) => {
  if (!metadataArray) {
    return;
  }

  const Cue = window$1.WebKitDataCue || window$1.VTTCue;
  const metadataTrack = inbandTextTracks.metadataTrack_;

  if (!metadataTrack) {
    return;
  }

  metadataArray.forEach(metadata => {
    const time = metadata.cueTime + timestampOffset; // if time isn't a finite number between 0 and Infinity, like NaN,
    // ignore this bit of metadata.
    // This likely occurs when you have an non-timed ID3 tag like TIT2,
    // which is the "Title/Songname/Content description" frame

    if (typeof time !== 'number' || window$1.isNaN(time) || time < 0 || !(time < Infinity)) {
      return;
    } // If we have no frames, we can't create a cue.


    if (!metadata.frames || !metadata.frames.length) {
      return;
    }

    metadata.frames.forEach(frame => {
      const cue = new Cue(time, time, frame.value || frame.url || frame.data || '');
      cue.frame = frame;
      cue.value = frame;
      deprecateOldCue(cue);
      metadataTrack.addCue(cue);
    });
  });

  if (!metadataTrack.cues || !metadataTrack.cues.length) {
    return;
  } // Updating the metadeta cues so that
  // the endTime of each cue is the startTime of the next cue
  // the endTime of last cue is the duration of the video


  const cues = metadataTrack.cues;
  const cuesArray = []; // Create a copy of the TextTrackCueList...
  // ...disregarding cues with a falsey value

  for (let i = 0; i < cues.length; i++) {
    if (cues[i]) {
      cuesArray.push(cues[i]);
    }
  } // Group cues by their startTime value


  const cuesGroupedByStartTime = cuesArray.reduce((obj, cue) => {
    const timeSlot = obj[cue.startTime] || [];
    timeSlot.push(cue);
    obj[cue.startTime] = timeSlot;
    return obj;
  }, {}); // Sort startTimes by ascending order

  const sortedStartTimes = Object.keys(cuesGroupedByStartTime).sort((a, b) => Number(a) - Number(b)); // Map each cue group's endTime to the next group's startTime

  sortedStartTimes.forEach((startTime, idx) => {
    const cueGroup = cuesGroupedByStartTime[startTime];
    const finiteDuration = isFinite(videoDuration) ? videoDuration : startTime;
    const nextTime = Number(sortedStartTimes[idx + 1]) || finiteDuration; // Map each cue's endTime the next group's startTime

    cueGroup.forEach(cue => {
      cue.endTime = nextTime;
    });
  });
}; // object for mapping daterange attributes

const dateRangeAttr = {
  id: 'ID',
  class: 'CLASS',
  startDate: 'START-DATE',
  duration: 'DURATION',
  endDate: 'END-DATE',
  endOnNext: 'END-ON-NEXT',
  plannedDuration: 'PLANNED-DURATION',
  scte35Out: 'SCTE35-OUT',
  scte35In: 'SCTE35-IN'
};
const dateRangeKeysToOmit = new Set(['id', 'class', 'startDate', 'duration', 'endDate', 'endOnNext', 'startTime', 'endTime', 'processDateRange']);
/**
 * Add DateRange metadata text track to a source handler given an array of metadata
 *
 * @param {Object}
 *   @param {Object} inbandTextTracks the inband text tracks
 *   @param {Array} dateRanges parsed media playlist
 * @private
 */

const addDateRangeMetadata = ({
  inbandTextTracks,
  dateRanges
}) => {
  const metadataTrack = inbandTextTracks.metadataTrack_;

  if (!metadataTrack) {
    return;
  }

  const Cue = window$1.WebKitDataCue || window$1.VTTCue;
  dateRanges.forEach(dateRange => {
    // we generate multiple cues for each date range with different attributes
    for (const key of Object.keys(dateRange)) {
      if (dateRangeKeysToOmit.has(key)) {
        continue;
      }

      const cue = new Cue(dateRange.startTime, dateRange.endTime, '');
      cue.id = dateRange.id;
      cue.type = 'com.apple.quicktime.HLS';
      cue.value = {
        key: dateRangeAttr[key],
        data: dateRange[key]
      };

      if (key === 'scte35Out' || key === 'scte35In') {
        cue.value.data = new Uint8Array(cue.value.data.match(/[\da-f]{2}/gi)).buffer;
      }

      metadataTrack.addCue(cue);
    }

    dateRange.processDateRange();
  });
};
/**
 * Create metadata text track on video.js if it does not exist
 *
 * @param {Object} inbandTextTracks a reference to current inbandTextTracks
 * @param {string} dispatchType the inband metadata track dispatch type
 * @param {Object} tech the video.js tech
 * @private
 */

const createMetadataTrackIfNotExists = (inbandTextTracks, dispatchType, tech) => {
  if (inbandTextTracks.metadataTrack_) {
    return;
  }

  inbandTextTracks.metadataTrack_ = tech.addRemoteTextTrack({
    kind: 'metadata',
    label: 'Timed Metadata'
  }, false).track;

  if (!videojs.browser.IS_ANY_SAFARI) {
    inbandTextTracks.metadataTrack_.inBandMetadataTrackDispatchType = dispatchType;
  }
};
/**
 * Remove cues from a track on video.js.
 *
 * @param {Double} start start of where we should remove the cue
 * @param {Double} end end of where the we should remove the cue
 * @param {Object} track the text track to remove the cues from
 * @private
 */

const removeCuesFromTrack = function (start, end, track) {
  let i;
  let cue;

  if (!track) {
    return;
  }

  if (!track.cues) {
    return;
  }

  i = track.cues.length;

  while (i--) {
    cue = track.cues[i]; // Remove any cue within the provided start and end time

    if (cue.startTime >= start && cue.endTime <= end) {
      track.removeCue(cue);
    }
  }
};
/**
 * Remove duplicate cues from a track on video.js (a cue is considered a
 * duplicate if it has the same time interval and text as another)
 *
 * @param {Object} track the text track to remove the duplicate cues from
 * @private
 */

const removeDuplicateCuesFromTrack = function (track) {
  const cues = track.cues;

  if (!cues) {
    return;
  }

  const uniqueCues = {};

  for (let i = cues.length - 1; i >= 0; i--) {
    const cue = cues[i];
    const cueKey = `${cue.startTime}-${cue.endTime}-${cue.text}`;

    if (uniqueCues[cueKey]) {
      track.removeCue(cue);
    } else {
      uniqueCues[cueKey] = cue;
    }
  }
};

/**
 * Returns a list of gops in the buffer that have a pts value of 3 seconds or more in
 * front of current time.
 *
 * @param {Array} buffer
 *        The current buffer of gop information
 * @param {number} currentTime
 *        The current time
 * @param {Double} mapping
 *        Offset to map display time to stream presentation time
 * @return {Array}
 *         List of gops considered safe to append over
 */

const gopsSafeToAlignWith = (buffer, currentTime, mapping) => {
  if (typeof currentTime === 'undefined' || currentTime === null || !buffer.length) {
    return [];
  } // pts value for current time + 3 seconds to give a bit more wiggle room


  const currentTimePts = Math.ceil((currentTime - mapping + 3) * ONE_SECOND_IN_TS);
  let i;

  for (i = 0; i < buffer.length; i++) {
    if (buffer[i].pts > currentTimePts) {
      break;
    }
  }

  return buffer.slice(i);
};
/**
 * Appends gop information (timing and byteLength) received by the transmuxer for the
 * gops appended in the last call to appendBuffer
 *
 * @param {Array} buffer
 *        The current buffer of gop information
 * @param {Array} gops
 *        List of new gop information
 * @param {boolean} replace
 *        If true, replace the buffer with the new gop information. If false, append the
 *        new gop information to the buffer in the right location of time.
 * @return {Array}
 *         Updated list of gop information
 */

const updateGopBuffer = (buffer, gops, replace) => {
  if (!gops.length) {
    return buffer;
  }

  if (replace) {
    // If we are in safe append mode, then completely overwrite the gop buffer
    // with the most recent appeneded data. This will make sure that when appending
    // future segments, we only try to align with gops that are both ahead of current
    // time and in the last segment appended.
    return gops.slice();
  }

  const start = gops[0].pts;
  let i = 0;

  for (i; i < buffer.length; i++) {
    if (buffer[i].pts >= start) {
      break;
    }
  }

  return buffer.slice(0, i).concat(gops);
};
/**
 * Removes gop information in buffer that overlaps with provided start and end
 *
 * @param {Array} buffer
 *        The current buffer of gop information
 * @param {Double} start
 *        position to start the remove at
 * @param {Double} end
 *        position to end the remove at
 * @param {Double} mapping
 *        Offset to map display time to stream presentation time
 */

const removeGopBuffer = (buffer, start, end, mapping) => {
  const startPts = Math.ceil((start - mapping) * ONE_SECOND_IN_TS);
  const endPts = Math.ceil((end - mapping) * ONE_SECOND_IN_TS);
  const updatedBuffer = buffer.slice();
  let i = buffer.length;

  while (i--) {
    if (buffer[i].pts <= endPts) {
      break;
    }
  }

  if (i === -1) {
    // no removal because end of remove range is before start of buffer
    return updatedBuffer;
  }

  let j = i + 1;

  while (j--) {
    if (buffer[j].pts <= startPts) {
      break;
    }
  } // clamp remove range start to 0 index


  j = Math.max(j, 0);
  updatedBuffer.splice(j, i - j + 1);
  return updatedBuffer;
};

const shallowEqual = function (a, b) {
  // if both are undefined
  // or one or the other is undefined
  // they are not equal
  if (!a && !b || !a && b || a && !b) {
    return false;
  } // they are the same object and thus, equal


  if (a === b) {
    return true;
  } // sort keys so we can make sure they have
  // all the same keys later.


  const akeys = Object.keys(a).sort();
  const bkeys = Object.keys(b).sort(); // different number of keys, not equal

  if (akeys.length !== bkeys.length) {
    return false;
  }

  for (let i = 0; i < akeys.length; i++) {
    const key = akeys[i]; // different sorted keys, not equal

    if (key !== bkeys[i]) {
      return false;
    } // different values, not equal


    if (a[key] !== b[key]) {
      return false;
    }
  }

  return true;
};

// https://www.w3.org/TR/WebIDL-1/#quotaexceedederror
const QUOTA_EXCEEDED_ERR = 22;

/**
 * The segment loader has no recourse except to fetch a segment in the
 * current playlist and use the internal timestamps in that segment to
 * generate a syncPoint. This function returns a good candidate index
 * for that process.
 *
 * @param {Array} segments - the segments array from a playlist.
 * @return {number} An index of a segment from the playlist to load
 */

const getSyncSegmentCandidate = function (currentTimeline, segments, targetTime) {
  segments = segments || [];
  const timelineSegments = [];
  let time = 0;

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];

    if (currentTimeline === segment.timeline) {
      timelineSegments.push(i);
      time += segment.duration;

      if (time > targetTime) {
        return i;
      }
    }
  }

  if (timelineSegments.length === 0) {
    return 0;
  } // default to the last timeline segment


  return timelineSegments[timelineSegments.length - 1];
}; // In the event of a quota exceeded error, keep at least one second of back buffer. This
// number was arbitrarily chosen and may be updated in the future, but seemed reasonable
// as a start to prevent any potential issues with removing content too close to the
// playhead.

const MIN_BACK_BUFFER = 1; // in ms

const CHECK_BUFFER_DELAY = 500;

const finite = num => typeof num === 'number' && isFinite(num); // With most content hovering around 30fps, if a segment has a duration less than a half
// frame at 30fps or one frame at 60fps, the bandwidth and throughput calculations will
// not accurately reflect the rest of the content.


const MIN_SEGMENT_DURATION_TO_SAVE_STATS = 1 / 60;
const illegalMediaSwitch = (loaderType, startingMedia, trackInfo) => {
  // Although these checks should most likely cover non 'main' types, for now it narrows
  // the scope of our checks.
  if (loaderType !== 'main' || !startingMedia || !trackInfo) {
    return null;
  }

  if (!trackInfo.hasAudio && !trackInfo.hasVideo) {
    return 'Neither audio nor video found in segment.';
  }

  if (startingMedia.hasVideo && !trackInfo.hasVideo) {
    return 'Only audio found in segment when we expected video.' + ' We can\'t switch to audio only from a stream that had video.' + ' To get rid of this message, please add codec information to the manifest.';
  }

  if (!startingMedia.hasVideo && trackInfo.hasVideo) {
    return 'Video found in segment when we expected only audio.' + ' We can\'t switch to a stream with video from an audio only stream.' + ' To get rid of this message, please add codec information to the manifest.';
  }

  return null;
};
/**
 * Calculates a time value that is safe to remove from the back buffer without interrupting
 * playback.
 *
 * @param {TimeRange} seekable
 *        The current seekable range
 * @param {number} currentTime
 *        The current time of the player
 * @param {number} targetDuration
 *        The target duration of the current playlist
 * @return {number}
 *         Time that is safe to remove from the back buffer without interrupting playback
 */

const safeBackBufferTrimTime = (seekable, currentTime, targetDuration) => {
  // 30 seconds before the playhead provides a safe default for trimming.
  //
  // Choosing a reasonable default is particularly important for high bitrate content and
  // VOD videos/live streams with large windows, as the buffer may end up overfilled and
  // throw an APPEND_BUFFER_ERR.
  let trimTime = currentTime - Config.BACK_BUFFER_LENGTH;

  if (seekable.length) {
    // Some live playlists may have a shorter window of content than the full allowed back
    // buffer. For these playlists, don't save content that's no longer within the window.
    trimTime = Math.max(trimTime, seekable.start(0));
  } // Don't remove within target duration of the current time to avoid the possibility of
  // removing the GOP currently being played, as removing it can cause playback stalls.


  const maxTrimTime = currentTime - targetDuration;
  return Math.min(maxTrimTime, trimTime);
};
const segmentInfoString = segmentInfo => {
  const {
    startOfSegment,
    duration,
    segment,
    part,
    playlist: {
      mediaSequence: seq,
      id,
      segments = []
    },
    mediaIndex: index,
    partIndex,
    timeline
  } = segmentInfo;
  const segmentLen = segments.length - 1;
  let selection = 'mediaIndex/partIndex increment';

  if (segmentInfo.getMediaInfoForTime) {
    selection = `getMediaInfoForTime (${segmentInfo.getMediaInfoForTime})`;
  } else if (segmentInfo.isSyncRequest) {
    selection = 'getSyncSegmentCandidate (isSyncRequest)';
  }

  if (segmentInfo.independent) {
    selection += ` with independent ${segmentInfo.independent}`;
  }

  const hasPartIndex = typeof partIndex === 'number';
  const name = segmentInfo.segment.uri ? 'segment' : 'pre-segment';
  const zeroBasedPartCount = hasPartIndex ? getKnownPartCount({
    preloadSegment: segment
  }) - 1 : 0;
  return `${name} [${seq + index}/${seq + segmentLen}]` + (hasPartIndex ? ` part [${partIndex}/${zeroBasedPartCount}]` : '') + ` segment start/end [${segment.start} => ${segment.end}]` + (hasPartIndex ? ` part start/end [${part.start} => ${part.end}]` : '') + ` startOfSegment [${startOfSegment}]` + ` duration [${duration}]` + ` timeline [${timeline}]` + ` selected by [${selection}]` + ` playlist [${id}]`;
};

const timingInfoPropertyForMedia = mediaType => `${mediaType}TimingInfo`;
/**
 * Returns the timestamp offset to use for the segment.
 *
 * @param {number} segmentTimeline
 *        The timeline of the segment
 * @param {number} currentTimeline
 *        The timeline currently being followed by the loader
 * @param {number} startOfSegment
 *        The estimated segment start
 * @param {TimeRange[]} buffered
 *        The loader's buffer
 * @param {boolean} overrideCheck
 *        If true, no checks are made to see if the timestamp offset value should be set,
 *        but sets it directly to a value.
 *
 * @return {number|null}
 *         Either a number representing a new timestamp offset, or null if the segment is
 *         part of the same timeline
 */


const timestampOffsetForSegment = ({
  segmentTimeline,
  currentTimeline,
  startOfSegment,
  buffered,
  overrideCheck
}) => {
  // Check to see if we are crossing a discontinuity to see if we need to set the
  // timestamp offset on the transmuxer and source buffer.
  //
  // Previously, we changed the timestampOffset if the start of this segment was less than
  // the currently set timestampOffset, but this isn't desirable as it can produce bad
  // behavior, especially around long running live streams.
  if (!overrideCheck && segmentTimeline === currentTimeline) {
    return null;
  } // When changing renditions, it's possible to request a segment on an older timeline. For
  // instance, given two renditions with the following:
  //
  // #EXTINF:10
  // segment1
  // #EXT-X-DISCONTINUITY
  // #EXTINF:10
  // segment2
  // #EXTINF:10
  // segment3
  //
  // And the current player state:
  //
  // current time: 8
  // buffer: 0 => 20
  //
  // The next segment on the current rendition would be segment3, filling the buffer from
  // 20s onwards. However, if a rendition switch happens after segment2 was requested,
  // then the next segment to be requested will be segment1 from the new rendition in
  // order to fill time 8 and onwards. Using the buffered end would result in repeated
  // content (since it would position segment1 of the new rendition starting at 20s). This
  // case can be identified when the new segment's timeline is a prior value. Instead of
  // using the buffered end, the startOfSegment can be used, which, hopefully, will be
  // more accurate to the actual start time of the segment.


  if (segmentTimeline < currentTimeline) {
    return startOfSegment;
  } // segmentInfo.startOfSegment used to be used as the timestamp offset, however, that
  // value uses the end of the last segment if it is available. While this value
  // should often be correct, it's better to rely on the buffered end, as the new
  // content post discontinuity should line up with the buffered end as if it were
  // time 0 for the new content.


  return buffered.length ? buffered.end(buffered.length - 1) : startOfSegment;
};
/**
 * Returns whether or not the loader should wait for a timeline change from the timeline
 * change controller before processing the segment.
 *
 * Primary timing in VHS goes by video. This is different from most media players, as
 * audio is more often used as the primary timing source. For the foreseeable future, VHS
 * will continue to use video as the primary timing source, due to the current logic and
 * expectations built around it.

 * Since the timing follows video, in order to maintain sync, the video loader is
 * responsible for setting both audio and video source buffer timestamp offsets.
 *
 * Setting different values for audio and video source buffers could lead to
 * desyncing. The following examples demonstrate some of the situations where this
 * distinction is important. Note that all of these cases involve demuxed content. When
 * content is muxed, the audio and video are packaged together, therefore syncing
 * separate media playlists is not an issue.
 *
 * CASE 1: Audio prepares to load a new timeline before video:
 *
 * Timeline:       0                 1
 * Audio Segments: 0 1 2 3 4 5 DISCO 6 7 8 9
 * Audio Loader:                     ^
 * Video Segments: 0 1 2 3 4 5 DISCO 6 7 8 9
 * Video Loader              ^
 *
 * In the above example, the audio loader is preparing to load the 6th segment, the first
 * after a discontinuity, while the video loader is still loading the 5th segment, before
 * the discontinuity.
 *
 * If the audio loader goes ahead and loads and appends the 6th segment before the video
 * loader crosses the discontinuity, then when appended, the 6th audio segment will use
 * the timestamp offset from timeline 0. This will likely lead to desyncing. In addition,
 * the audio loader must provide the audioAppendStart value to trim the content in the
 * transmuxer, and that value relies on the audio timestamp offset. Since the audio
 * timestamp offset is set by the video (main) loader, the audio loader shouldn't load the
 * segment until that value is provided.
 *
 * CASE 2: Video prepares to load a new timeline before audio:
 *
 * Timeline:       0                 1
 * Audio Segments: 0 1 2 3 4 5 DISCO 6 7 8 9
 * Audio Loader:             ^
 * Video Segments: 0 1 2 3 4 5 DISCO 6 7 8 9
 * Video Loader                      ^
 *
 * In the above example, the video loader is preparing to load the 6th segment, the first
 * after a discontinuity, while the audio loader is still loading the 5th segment, before
 * the discontinuity.
 *
 * If the video loader goes ahead and loads and appends the 6th segment, then once the
 * segment is loaded and processed, both the video and audio timestamp offsets will be
 * set, since video is used as the primary timing source. This is to ensure content lines
 * up appropriately, as any modifications to the video timing are reflected by audio when
 * the video loader sets the audio and video timestamp offsets to the same value. However,
 * setting the timestamp offset for audio before audio has had a chance to change
 * timelines will likely lead to desyncing, as the audio loader will append segment 5 with
 * a timestamp intended to apply to segments from timeline 1 rather than timeline 0.
 *
 * CASE 3: When seeking, audio prepares to load a new timeline before video
 *
 * Timeline:       0                 1
 * Audio Segments: 0 1 2 3 4 5 DISCO 6 7 8 9
 * Audio Loader:           ^
 * Video Segments: 0 1 2 3 4 5 DISCO 6 7 8 9
 * Video Loader            ^
 *
 * In the above example, both audio and video loaders are loading segments from timeline
 * 0, but imagine that the seek originated from timeline 1.
 *
 * When seeking to a new timeline, the timestamp offset will be set based on the expected
 * segment start of the loaded video segment. In order to maintain sync, the audio loader
 * must wait for the video loader to load its segment and update both the audio and video
 * timestamp offsets before it may load and append its own segment. This is the case
 * whether the seek results in a mismatched segment request (e.g., the audio loader
 * chooses to load segment 3 and the video loader chooses to load segment 4) or the
 * loaders choose to load the same segment index from each playlist, as the segments may
 * not be aligned perfectly, even for matching segment indexes.
 *
 * @param {Object} timelinechangeController
 * @param {number} currentTimeline
 *        The timeline currently being followed by the loader
 * @param {number} segmentTimeline
 *        The timeline of the segment being loaded
 * @param {('main'|'audio')} loaderType
 *        The loader type
 * @param {boolean} audioDisabled
 *        Whether the audio is disabled for the loader. This should only be true when the
 *        loader may have muxed audio in its segment, but should not append it, e.g., for
 *        the main loader when an alternate audio playlist is active.
 *
 * @return {boolean}
 *         Whether the loader should wait for a timeline change from the timeline change
 *         controller before processing the segment
 */

const shouldWaitForTimelineChange = ({
  timelineChangeController,
  currentTimeline,
  segmentTimeline,
  loaderType,
  audioDisabled
}) => {
  if (currentTimeline === segmentTimeline) {
    return false;
  }

  if (loaderType === 'audio') {
    const lastMainTimelineChange = timelineChangeController.lastTimelineChange({
      type: 'main'
    }); // Audio loader should wait if:
    //
    // * main hasn't had a timeline change yet (thus has not loaded its first segment)
    // * main hasn't yet changed to the timeline audio is looking to load

    return !lastMainTimelineChange || lastMainTimelineChange.to !== segmentTimeline;
  } // The main loader only needs to wait for timeline changes if there's demuxed audio.
  // Otherwise, there's nothing to wait for, since audio would be muxed into the main
  // loader's segments (or the content is audio/video only and handled by the main
  // loader).


  if (loaderType === 'main' && audioDisabled) {
    const pendingAudioTimelineChange = timelineChangeController.pendingTimelineChange({
      type: 'audio'
    }); // Main loader should wait for the audio loader if audio is not pending a timeline
    // change to the current timeline.
    //
    // Since the main loader is responsible for setting the timestamp offset for both
    // audio and video, the main loader must wait for audio to be about to change to its
    // timeline before setting the offset, otherwise, if audio is behind in loading,
    // segments from the previous timeline would be adjusted by the new timestamp offset.
    //
    // This requirement means that video will not cross a timeline until the audio is
    // about to cross to it, so that way audio and video will always cross the timeline
    // together.
    //
    // In addition to normal timeline changes, these rules also apply to the start of a
    // stream (going from a non-existent timeline, -1, to timeline 0). It's important
    // that these rules apply to the first timeline change because if they did not, it's
    // possible that the main loader will cross two timelines before the audio loader has
    // crossed one. Logic may be implemented to handle the startup as a special case, but
    // it's easier to simply treat all timeline changes the same.

    if (pendingAudioTimelineChange && pendingAudioTimelineChange.to === segmentTimeline) {
      return false;
    }

    return true;
  }

  return false;
};
const mediaDuration = timingInfos => {
  let maxDuration = 0;
  ['video', 'audio'].forEach(function (type) {
    const typeTimingInfo = timingInfos[`${type}TimingInfo`];

    if (!typeTimingInfo) {
      return;
    }

    const {
      start,
      end
    } = typeTimingInfo;
    let duration;

    if (typeof start === 'bigint' || typeof end === 'bigint') {
      duration = window$1.BigInt(end) - window$1.BigInt(start);
    } else if (typeof start === 'number' && typeof end === 'number') {
      duration = end - start;
    }

    if (typeof duration !== 'undefined' && duration > maxDuration) {
      maxDuration = duration;
    }
  }); // convert back to a number if it is lower than MAX_SAFE_INTEGER
  // as we only need BigInt when we are above that.

  if (typeof maxDuration === 'bigint' && maxDuration < Number.MAX_SAFE_INTEGER) {
    maxDuration = Number(maxDuration);
  }

  return maxDuration;
};
const segmentTooLong = ({
  segmentDuration,
  maxDuration
}) => {
  // 0 duration segments are most likely due to metadata only segments or a lack of
  // information.
  if (!segmentDuration) {
    return false;
  } // For HLS:
  //
  // https://tools.ietf.org/html/draft-pantos-http-live-streaming-23#section-4.3.3.1
  // The EXTINF duration of each Media Segment in the Playlist
  // file, when rounded to the nearest integer, MUST be less than or equal
  // to the target duration; longer segments can trigger playback stalls
  // or other errors.
  //
  // For DASH, the mpd-parser uses the largest reported segment duration as the target
  // duration. Although that reported duration is occasionally approximate (i.e., not
  // exact), a strict check may report that a segment is too long more often in DASH.


  return Math.round(segmentDuration) > maxDuration + TIME_FUDGE_FACTOR;
};
const getTroublesomeSegmentDurationMessage = (segmentInfo, sourceType) => {
  // Right now we aren't following DASH's timing model exactly, so only perform
  // this check for HLS content.
  if (sourceType !== 'hls') {
    return null;
  }

  const segmentDuration = mediaDuration({
    audioTimingInfo: segmentInfo.audioTimingInfo,
    videoTimingInfo: segmentInfo.videoTimingInfo
  }); // Don't report if we lack information.
  //
  // If the segment has a duration of 0 it is either a lack of information or a
  // metadata only segment and shouldn't be reported here.

  if (!segmentDuration) {
    return null;
  }

  const targetDuration = segmentInfo.playlist.targetDuration;
  const isSegmentWayTooLong = segmentTooLong({
    segmentDuration,
    maxDuration: targetDuration * 2
  });
  const isSegmentSlightlyTooLong = segmentTooLong({
    segmentDuration,
    maxDuration: targetDuration
  });
  const segmentTooLongMessage = `Segment with index ${segmentInfo.mediaIndex} ` + `from playlist ${segmentInfo.playlist.id} ` + `has a duration of ${segmentDuration} ` + `when the reported duration is ${segmentInfo.duration} ` + `and the target duration is ${targetDuration}. ` + 'For HLS content, a duration in excess of the target duration may result in ' + 'playback issues. See the HLS specification section on EXT-X-TARGETDURATION for ' + 'more details: ' + 'https://tools.ietf.org/html/draft-pantos-http-live-streaming-23#section-4.3.3.1';

  if (isSegmentWayTooLong || isSegmentSlightlyTooLong) {
    return {
      severity: isSegmentWayTooLong ? 'warn' : 'info',
      message: segmentTooLongMessage
    };
  }

  return null;
};
/**
 * An object that manages segment loading and appending.
 *
 * @class SegmentLoader
 * @param {Object} options required and optional options
 * @extends videojs.EventTarget
 */

class SegmentLoader extends videojs.EventTarget {
  constructor(settings, options = {}) {
    super(); // check pre-conditions

    if (!settings) {
      throw new TypeError('Initialization settings are required');
    }

    if (typeof settings.currentTime !== 'function') {
      throw new TypeError('No currentTime getter specified');
    }

    if (!settings.mediaSource) {
      throw new TypeError('No MediaSource specified');
    } // public properties


    this.bandwidth = settings.bandwidth;
    this.throughput = {
      rate: 0,
      count: 0
    };
    this.roundTrip = NaN;
    this.resetStats_();
    this.mediaIndex = null;
    this.partIndex = null; // private settings

    this.hasPlayed_ = settings.hasPlayed;
    this.currentTime_ = settings.currentTime;
    this.seekable_ = settings.seekable;
    this.seeking_ = settings.seeking;
    this.duration_ = settings.duration;
    this.mediaSource_ = settings.mediaSource;
    this.vhs_ = settings.vhs;
    this.loaderType_ = settings.loaderType;
    this.currentMediaInfo_ = void 0;
    this.startingMediaInfo_ = void 0;
    this.segmentMetadataTrack_ = settings.segmentMetadataTrack;
    this.goalBufferLength_ = settings.goalBufferLength;
    this.sourceType_ = settings.sourceType;
    this.sourceUpdater_ = settings.sourceUpdater;
    this.inbandTextTracks_ = settings.inbandTextTracks;
    this.state_ = 'INIT';
    this.timelineChangeController_ = settings.timelineChangeController;
    this.shouldSaveSegmentTimingInfo_ = true;
    this.parse708captions_ = settings.parse708captions;
    this.useDtsForTimestampOffset_ = settings.useDtsForTimestampOffset;
    this.captionServices_ = settings.captionServices;
    this.exactManifestTimings = settings.exactManifestTimings;
    this.addMetadataToTextTrack = settings.addMetadataToTextTrack; // private instance variables

    this.checkBufferTimeout_ = null;
    this.error_ = void 0;
    this.currentTimeline_ = -1;
    this.shouldForceTimestampOffsetAfterResync_ = false;
    this.pendingSegment_ = null;
    this.xhrOptions_ = null;
    this.pendingSegments_ = [];
    this.audioDisabled_ = false;
    this.isPendingTimestampOffset_ = false; // TODO possibly move gopBuffer and timeMapping info to a separate controller

    this.gopBuffer_ = [];
    this.timeMapping_ = 0;
    this.safeAppend_ = false;
    this.appendInitSegment_ = {
      audio: true,
      video: true
    };
    this.playlistOfLastInitSegment_ = {
      audio: null,
      video: null
    };
    this.callQueue_ = []; // If the segment loader prepares to load a segment, but does not have enough
    // information yet to start the loading process (e.g., if the audio loader wants to
    // load a segment from the next timeline but the main loader hasn't yet crossed that
    // timeline), then the load call will be added to the queue until it is ready to be
    // processed.

    this.loadQueue_ = [];
    this.metadataQueue_ = {
      id3: [],
      caption: []
    };
    this.waitingOnRemove_ = false;
    this.quotaExceededErrorRetryTimeout_ = null; // Fragmented mp4 playback

    this.activeInitSegmentId_ = null;
    this.initSegments_ = {}; // HLSe playback

    this.cacheEncryptionKeys_ = settings.cacheEncryptionKeys;
    this.keyCache_ = {};
    this.decrypter_ = settings.decrypter; // Manages the tracking and generation of sync-points, mappings
    // between a time in the display time and a segment index within
    // a playlist

    this.syncController_ = settings.syncController;
    this.syncPoint_ = {
      segmentIndex: 0,
      time: 0
    };
    this.transmuxer_ = this.createTransmuxer_();

    this.triggerSyncInfoUpdate_ = () => this.trigger('syncinfoupdate');

    this.syncController_.on('syncinfoupdate', this.triggerSyncInfoUpdate_);
    this.mediaSource_.addEventListener('sourceopen', () => {
      if (!this.isEndOfStream_()) {
        this.ended_ = false;
      }
    }); // ...for determining the fetch location

    this.fetchAtBuffer_ = false;
    this.logger_ = logger(`SegmentLoader[${this.loaderType_}]`);
    Object.defineProperty(this, 'state', {
      get() {
        return this.state_;
      },

      set(newState) {
        if (newState !== this.state_) {
          this.logger_(`${this.state_} -> ${newState}`);
          this.state_ = newState;
          this.trigger('statechange');
        }
      }

    });
    this.sourceUpdater_.on('ready', () => {
      if (this.hasEnoughInfoToAppend_()) {
        this.processCallQueue_();
      }
    }); // Only the main loader needs to listen for pending timeline changes, as the main
    // loader should wait for audio to be ready to change its timeline so that both main
    // and audio timelines change together. For more details, see the
    // shouldWaitForTimelineChange function.

    if (this.loaderType_ === 'main') {
      this.timelineChangeController_.on('pendingtimelinechange', () => {
        if (this.hasEnoughInfoToAppend_()) {
          this.processCallQueue_();
        }
      });
    } // The main loader only listens on pending timeline changes, but the audio loader,
    // since its loads follow main, needs to listen on timeline changes. For more details,
    // see the shouldWaitForTimelineChange function.


    if (this.loaderType_ === 'audio') {
      this.timelineChangeController_.on('timelinechange', () => {
        if (this.hasEnoughInfoToLoad_()) {
          this.processLoadQueue_();
        }

        if (this.hasEnoughInfoToAppend_()) {
          this.processCallQueue_();
        }
      });
    }
  }

  createTransmuxer_() {
    return segmentTransmuxer.createTransmuxer({
      remux: false,
      alignGopsAtEnd: this.safeAppend_,
      keepOriginalTimestamps: true,
      parse708captions: this.parse708captions_,
      captionServices: this.captionServices_
    });
  }
  /**
   * reset all of our media stats
   *
   * @private
   */


  resetStats_() {
    this.mediaBytesTransferred = 0;
    this.mediaRequests = 0;
    this.mediaRequestsAborted = 0;
    this.mediaRequestsTimedout = 0;
    this.mediaRequestsErrored = 0;
    this.mediaTransferDuration = 0;
    this.mediaSecondsLoaded = 0;
    this.mediaAppends = 0;
  }
  /**
   * dispose of the SegmentLoader and reset to the default state
   */


  dispose() {
    this.trigger('dispose');
    this.state = 'DISPOSED';
    this.pause();
    this.abort_();

    if (this.transmuxer_) {
      this.transmuxer_.terminate();
    }

    this.resetStats_();

    if (this.checkBufferTimeout_) {
      window$1.clearTimeout(this.checkBufferTimeout_);
    }

    if (this.syncController_ && this.triggerSyncInfoUpdate_) {
      this.syncController_.off('syncinfoupdate', this.triggerSyncInfoUpdate_);
    }

    this.off();
  }

  setAudio(enable) {
    this.audioDisabled_ = !enable;

    if (enable) {
      this.appendInitSegment_.audio = true;
    } else {
      // remove current track audio if it gets disabled
      this.sourceUpdater_.removeAudio(0, this.duration_());
    }
  }
  /**
   * abort anything that is currently doing on with the SegmentLoader
   * and reset to a default state
   */


  abort() {
    if (this.state !== 'WAITING') {
      if (this.pendingSegment_) {
        this.pendingSegment_ = null;
      }

      return;
    }

    this.abort_(); // We aborted the requests we were waiting on, so reset the loader's state to READY
    // since we are no longer "waiting" on any requests. XHR callback is not always run
    // when the request is aborted. This will prevent the loader from being stuck in the
    // WAITING state indefinitely.

    this.state = 'READY'; // don't wait for buffer check timeouts to begin fetching the
    // next segment

    if (!this.paused()) {
      this.monitorBuffer_();
    }
  }
  /**
   * abort all pending xhr requests and null any pending segements
   *
   * @private
   */


  abort_() {
    if (this.pendingSegment_ && this.pendingSegment_.abortRequests) {
      this.pendingSegment_.abortRequests();
    } // clear out the segment being processed


    this.pendingSegment_ = null;
    this.callQueue_ = [];
    this.loadQueue_ = [];
    this.metadataQueue_.id3 = [];
    this.metadataQueue_.caption = [];
    this.timelineChangeController_.clearPendingTimelineChange(this.loaderType_);
    this.waitingOnRemove_ = false;
    window$1.clearTimeout(this.quotaExceededErrorRetryTimeout_);
    this.quotaExceededErrorRetryTimeout_ = null;
  }

  checkForAbort_(requestId) {
    // If the state is APPENDING, then aborts will not modify the state, meaning the first
    // callback that happens should reset the state to READY so that loading can continue.
    if (this.state === 'APPENDING' && !this.pendingSegment_) {
      this.state = 'READY';
      return true;
    }

    if (!this.pendingSegment_ || this.pendingSegment_.requestId !== requestId) {
      return true;
    }

    return false;
  }
  /**
   * set an error on the segment loader and null out any pending segements
   *
   * @param {Error} error the error to set on the SegmentLoader
   * @return {Error} the error that was set or that is currently set
   */


  error(error) {
    if (typeof error !== 'undefined') {
      this.logger_('error occurred:', error);
      this.error_ = error;
    }

    this.pendingSegment_ = null;
    return this.error_;
  }

  endOfStream() {
    this.ended_ = true;

    if (this.transmuxer_) {
      // need to clear out any cached data to prepare for the new segment
      segmentTransmuxer.reset(this.transmuxer_);
    }

    this.gopBuffer_.length = 0;
    this.pause();
    this.trigger('ended');
  }
  /**
   * Indicates which time ranges are buffered
   *
   * @return {TimeRange}
   *         TimeRange object representing the current buffered ranges
   */


  buffered_() {
    const trackInfo = this.getMediaInfo_();

    if (!this.sourceUpdater_ || !trackInfo) {
      return createTimeRanges();
    }

    if (this.loaderType_ === 'main') {
      const {
        hasAudio,
        hasVideo,
        isMuxed
      } = trackInfo;

      if (hasVideo && hasAudio && !this.audioDisabled_ && !isMuxed) {
        return this.sourceUpdater_.buffered();
      }

      if (hasVideo) {
        return this.sourceUpdater_.videoBuffered();
      }
    } // One case that can be ignored for now is audio only with alt audio,
    // as we don't yet have proper support for that.


    return this.sourceUpdater_.audioBuffered();
  }
  /**
   * Gets and sets init segment for the provided map
   *
   * @param {Object} map
   *        The map object representing the init segment to get or set
   * @param {boolean=} set
   *        If true, the init segment for the provided map should be saved
   * @return {Object}
   *         map object for desired init segment
   */


  initSegmentForMap(map, set = false) {
    if (!map) {
      return null;
    }

    const id = initSegmentId(map);
    let storedMap = this.initSegments_[id];

    if (set && !storedMap && map.bytes) {
      this.initSegments_[id] = storedMap = {
        resolvedUri: map.resolvedUri,
        byterange: map.byterange,
        bytes: map.bytes,
        tracks: map.tracks,
        timescales: map.timescales
      };
    }

    return storedMap || map;
  }
  /**
   * Gets and sets key for the provided key
   *
   * @param {Object} key
   *        The key object representing the key to get or set
   * @param {boolean=} set
   *        If true, the key for the provided key should be saved
   * @return {Object}
   *         Key object for desired key
   */


  segmentKey(key, set = false) {
    if (!key) {
      return null;
    }

    const id = segmentKeyId(key);
    let storedKey = this.keyCache_[id]; // TODO: We should use the HTTP Expires header to invalidate our cache per
    // https://tools.ietf.org/html/draft-pantos-http-live-streaming-23#section-6.2.3

    if (this.cacheEncryptionKeys_ && set && !storedKey && key.bytes) {
      this.keyCache_[id] = storedKey = {
        resolvedUri: key.resolvedUri,
        bytes: key.bytes
      };
    }

    const result = {
      resolvedUri: (storedKey || key).resolvedUri
    };

    if (storedKey) {
      result.bytes = storedKey.bytes;
    }

    return result;
  }
  /**
   * Returns true if all configuration required for loading is present, otherwise false.
   *
   * @return {boolean} True if the all configuration is ready for loading
   * @private
   */


  couldBeginLoading_() {
    return this.playlist_ && !this.paused();
  }
  /**
   * load a playlist and start to fill the buffer
   */


  load() {
    // un-pause
    this.monitorBuffer_(); // if we don't have a playlist yet, keep waiting for one to be
    // specified

    if (!this.playlist_) {
      return;
    } // if all the configuration is ready, initialize and begin loading


    if (this.state === 'INIT' && this.couldBeginLoading_()) {
      return this.init_();
    } // if we're in the middle of processing a segment already, don't
    // kick off an additional segment request


    if (!this.couldBeginLoading_() || this.state !== 'READY' && this.state !== 'INIT') {
      return;
    }

    this.state = 'READY';
  }
  /**
   * Once all the starting parameters have been specified, begin
   * operation. This method should only be invoked from the INIT
   * state.
   *
   * @private
   */


  init_() {
    this.state = 'READY'; // if this is the audio segment loader, and it hasn't been inited before, then any old
    // audio data from the muxed content should be removed

    this.resetEverything();
    return this.monitorBuffer_();
  }
  /**
   * set a playlist on the segment loader
   *
   * @param {PlaylistLoader} media the playlist to set on the segment loader
   */


  playlist(newPlaylist, options = {}) {
    if (!newPlaylist) {
      return;
    }

    const oldPlaylist = this.playlist_;
    const segmentInfo = this.pendingSegment_;
    this.playlist_ = newPlaylist;
    this.xhrOptions_ = options; // when we haven't started playing yet, the start of a live playlist
    // is always our zero-time so force a sync update each time the playlist
    // is refreshed from the server
    //
    // Use the INIT state to determine if playback has started, as the playlist sync info
    // should be fixed once requests begin (as sync points are generated based on sync
    // info), but not before then.

    if (this.state === 'INIT') {
      newPlaylist.syncInfo = {
        mediaSequence: newPlaylist.mediaSequence,
        time: 0
      }; // Setting the date time mapping means mapping the program date time (if available)
      // to time 0 on the player's timeline. The playlist's syncInfo serves a similar
      // purpose, mapping the initial mediaSequence to time zero. Since the syncInfo can
      // be updated as the playlist is refreshed before the loader starts loading, the
      // program date time mapping needs to be updated as well.
      //
      // This mapping is only done for the main loader because a program date time should
      // map equivalently between playlists.

      if (this.loaderType_ === 'main') {
        this.syncController_.setDateTimeMappingForStart(newPlaylist);
      }
    }

    let oldId = null;

    if (oldPlaylist) {
      if (oldPlaylist.id) {
        oldId = oldPlaylist.id;
      } else if (oldPlaylist.uri) {
        oldId = oldPlaylist.uri;
      }
    }

    this.logger_(`playlist update [${oldId} => ${newPlaylist.id || newPlaylist.uri}]`);
    this.syncController_.updateMediaSequenceMap(newPlaylist, this.currentTime_(), this.loaderType_); // in VOD, this is always a rendition switch (or we updated our syncInfo above)
    // in LIVE, we always want to update with new playlists (including refreshes)

    this.trigger('syncinfoupdate'); // if we were unpaused but waiting for a playlist, start
    // buffering now

    if (this.state === 'INIT' && this.couldBeginLoading_()) {
      return this.init_();
    }

    if (!oldPlaylist || oldPlaylist.uri !== newPlaylist.uri) {
      if (this.mediaIndex !== null) {
        // we must reset/resync the segment loader when we switch renditions and
        // the segment loader is already synced to the previous rendition
        // We only want to reset the loader here for LLHLS playback, as resetLoader sets fetchAtBuffer_
        // to false, resulting in fetching segments at currentTime and causing repeated
        // same-segment requests on playlist change. This erroneously drives up the playback watcher
        // stalled segment count, as re-requesting segments at the currentTime or browser cached segments
        // will not change the buffer.
        // Reference for LLHLS fixes: https://github.com/videojs/http-streaming/pull/1201
        const isLLHLS = !newPlaylist.endList && typeof newPlaylist.partTargetDuration === 'number';

        if (isLLHLS) {
          this.resetLoader();
        } else {
          this.resyncLoader();
        }
      }

      this.currentMediaInfo_ = void 0;
      this.trigger('playlistupdate'); // the rest of this function depends on `oldPlaylist` being defined

      return;
    } // we reloaded the same playlist so we are in a live scenario
    // and we will likely need to adjust the mediaIndex


    const mediaSequenceDiff = newPlaylist.mediaSequence - oldPlaylist.mediaSequence;
    this.logger_(`live window shift [${mediaSequenceDiff}]`); // update the mediaIndex on the SegmentLoader
    // this is important because we can abort a request and this value must be
    // equal to the last appended mediaIndex

    if (this.mediaIndex !== null) {
      this.mediaIndex -= mediaSequenceDiff; // this can happen if we are going to load the first segment, but get a playlist
      // update during that. mediaIndex would go from 0 to -1 if mediaSequence in the
      // new playlist was incremented by 1.

      if (this.mediaIndex < 0) {
        this.mediaIndex = null;
        this.partIndex = null;
      } else {
        const segment = this.playlist_.segments[this.mediaIndex]; // partIndex should remain the same for the same segment
        // unless parts fell off of the playlist for this segment.
        // In that case we need to reset partIndex and resync

        if (this.partIndex && (!segment.parts || !segment.parts.length || !segment.parts[this.partIndex])) {
          const mediaIndex = this.mediaIndex;
          this.logger_(`currently processing part (index ${this.partIndex}) no longer exists.`);
          this.resetLoader(); // We want to throw away the partIndex and the data associated with it,
          // as the part was dropped from our current playlists segment.
          // The mediaIndex will still be valid so keep that around.

          this.mediaIndex = mediaIndex;
        }
      }
    } // update the mediaIndex on the SegmentInfo object
    // this is important because we will update this.mediaIndex with this value
    // in `handleAppendsDone_` after the segment has been successfully appended


    if (segmentInfo) {
      segmentInfo.mediaIndex -= mediaSequenceDiff;

      if (segmentInfo.mediaIndex < 0) {
        segmentInfo.mediaIndex = null;
        segmentInfo.partIndex = null;
      } else {
        // we need to update the referenced segment so that timing information is
        // saved for the new playlist's segment, however, if the segment fell off the
        // playlist, we can leave the old reference and just lose the timing info
        if (segmentInfo.mediaIndex >= 0) {
          segmentInfo.segment = newPlaylist.segments[segmentInfo.mediaIndex];
        }

        if (segmentInfo.partIndex >= 0 && segmentInfo.segment.parts) {
          segmentInfo.part = segmentInfo.segment.parts[segmentInfo.partIndex];
        }
      }
    }

    this.syncController_.saveExpiredSegmentInfo(oldPlaylist, newPlaylist);
  }
  /**
   * Prevent the loader from fetching additional segments. If there
   * is a segment request outstanding, it will finish processing
   * before the loader halts. A segment loader can be unpaused by
   * calling load().
   */


  pause() {
    if (this.checkBufferTimeout_) {
      window$1.clearTimeout(this.checkBufferTimeout_);
      this.checkBufferTimeout_ = null;
    }
  }
  /**
   * Returns whether the segment loader is fetching additional
   * segments when given the opportunity. This property can be
   * modified through calls to pause() and load().
   */


  paused() {
    return this.checkBufferTimeout_ === null;
  }
  /**
   * Delete all the buffered data and reset the SegmentLoader
   *
   * @param {Function} [done] an optional callback to be executed when the remove
   * operation is complete
   */


  resetEverything(done) {
    this.ended_ = false;
    this.activeInitSegmentId_ = null;
    this.appendInitSegment_ = {
      audio: true,
      video: true
    };
    this.resetLoader(); // remove from 0, the earliest point, to Infinity, to signify removal of everything.
    // VTT Segment Loader doesn't need to do anything but in the regular SegmentLoader,
    // we then clamp the value to duration if necessary.

    this.remove(0, Infinity, done); // clears fmp4 captions

    if (this.transmuxer_) {
      this.transmuxer_.postMessage({
        action: 'clearAllMp4Captions'
      }); // reset the cache in the transmuxer

      this.transmuxer_.postMessage({
        action: 'reset'
      });
    }
  }
  /**
   * Force the SegmentLoader to resync and start loading around the currentTime instead
   * of starting at the end of the buffer
   *
   * Useful for fast quality changes
   */


  resetLoader() {
    this.fetchAtBuffer_ = false;
    this.resyncLoader();
  }
  /**
   * Force the SegmentLoader to restart synchronization and make a conservative guess
   * before returning to the simple walk-forward method
   */


  resyncLoader() {
    if (this.transmuxer_) {
      // need to clear out any cached data to prepare for the new segment
      segmentTransmuxer.reset(this.transmuxer_);
    }

    this.mediaIndex = null;
    this.partIndex = null;
    this.syncPoint_ = null;
    this.isPendingTimestampOffset_ = false;
    this.shouldForceTimestampOffsetAfterResync_ = true;
    this.callQueue_ = [];
    this.loadQueue_ = [];
    this.metadataQueue_.id3 = [];
    this.metadataQueue_.caption = [];
    this.abort();

    if (this.transmuxer_) {
      this.transmuxer_.postMessage({
        action: 'clearParsedMp4Captions'
      });
    }
  }
  /**
   * Remove any data in the source buffer between start and end times
   *
   * @param {number} start - the start time of the region to remove from the buffer
   * @param {number} end - the end time of the region to remove from the buffer
   * @param {Function} [done] - an optional callback to be executed when the remove
   * @param {boolean} force - force all remove operations to happen
   * operation is complete
   */


  remove(start, end, done = () => {}, force = false) {
    // clamp end to duration if we need to remove everything.
    // This is due to a browser bug that causes issues if we remove to Infinity.
    // videojs/videojs-contrib-hls#1225
    if (end === Infinity) {
      end = this.duration_();
    } // skip removes that would throw an error
    // commonly happens during a rendition switch at the start of a video
    // from start 0 to end 0


    if (end <= start) {
      this.logger_('skipping remove because end ${end} is <= start ${start}');
      return;
    }

    if (!this.sourceUpdater_ || !this.getMediaInfo_()) {
      this.logger_('skipping remove because no source updater or starting media info'); // nothing to remove if we haven't processed any media

      return;
    } // set it to one to complete this function's removes


    let removesRemaining = 1;

    const removeFinished = () => {
      removesRemaining--;

      if (removesRemaining === 0) {
        done();
      }
    };

    if (force || !this.audioDisabled_) {
      removesRemaining++;
      this.sourceUpdater_.removeAudio(start, end, removeFinished);
    } // While it would be better to only remove video if the main loader has video, this
    // should be safe with audio only as removeVideo will call back even if there's no
    // video buffer.
    //
    // In theory we can check to see if there's video before calling the remove, but in
    // the event that we're switching between renditions and from video to audio only
    // (when we add support for that), we may need to clear the video contents despite
    // what the new media will contain.


    if (force || this.loaderType_ === 'main') {
      this.gopBuffer_ = removeGopBuffer(this.gopBuffer_, start, end, this.timeMapping_);
      removesRemaining++;
      this.sourceUpdater_.removeVideo(start, end, removeFinished);
    } // remove any captions and ID3 tags


    for (const track in this.inbandTextTracks_) {
      removeCuesFromTrack(start, end, this.inbandTextTracks_[track]);
    }

    removeCuesFromTrack(start, end, this.segmentMetadataTrack_); // finished this function's removes

    removeFinished();
  }
  /**
   * (re-)schedule monitorBufferTick_ to run as soon as possible
   *
   * @private
   */


  monitorBuffer_() {
    if (this.checkBufferTimeout_) {
      window$1.clearTimeout(this.checkBufferTimeout_);
    }

    this.checkBufferTimeout_ = window$1.setTimeout(this.monitorBufferTick_.bind(this), 1);
  }
  /**
   * As long as the SegmentLoader is in the READY state, periodically
   * invoke fillBuffer_().
   *
   * @private
   */


  monitorBufferTick_() {
    if (this.state === 'READY') {
      this.fillBuffer_();
    }

    if (this.checkBufferTimeout_) {
      window$1.clearTimeout(this.checkBufferTimeout_);
    }

    this.checkBufferTimeout_ = window$1.setTimeout(this.monitorBufferTick_.bind(this), CHECK_BUFFER_DELAY);
  }
  /**
   * fill the buffer with segements unless the sourceBuffers are
   * currently updating
   *
   * Note: this function should only ever be called by monitorBuffer_
   * and never directly
   *
   * @private
   */


  fillBuffer_() {
    // TODO since the source buffer maintains a queue, and we shouldn't call this function
    // except when we're ready for the next segment, this check can most likely be removed
    if (this.sourceUpdater_.updating()) {
      return;
    } // see if we need to begin loading immediately


    const segmentInfo = this.chooseNextRequest_();

    if (!segmentInfo) {
      return;
    }

    if (typeof segmentInfo.timestampOffset === 'number') {
      this.isPendingTimestampOffset_ = false;
      this.timelineChangeController_.pendingTimelineChange({
        type: this.loaderType_,
        from: this.currentTimeline_,
        to: segmentInfo.timeline
      });
    }

    this.loadSegment_(segmentInfo);
  }
  /**
   * Determines if we should call endOfStream on the media source based
   * on the state of the buffer or if appened segment was the final
   * segment in the playlist.
   *
   * @param {number} [mediaIndex] the media index of segment we last appended
   * @param {Object} [playlist] a media playlist object
   * @return {boolean} do we need to call endOfStream on the MediaSource
   */


  isEndOfStream_(mediaIndex = this.mediaIndex, playlist = this.playlist_, partIndex = this.partIndex) {
    if (!playlist || !this.mediaSource_) {
      return false;
    }

    const segment = typeof mediaIndex === 'number' && playlist.segments[mediaIndex]; // mediaIndex is zero based but length is 1 based

    const appendedLastSegment = mediaIndex + 1 === playlist.segments.length; // true if there are no parts, or this is the last part.

    const appendedLastPart = !segment || !segment.parts || partIndex + 1 === segment.parts.length; // if we've buffered to the end of the video, we need to call endOfStream
    // so that MediaSources can trigger the `ended` event when it runs out of
    // buffered data instead of waiting for me

    return playlist.endList && this.mediaSource_.readyState === 'open' && appendedLastSegment && appendedLastPart;
  }
  /**
   * Determines what request should be made given current segment loader state.
   *
   * @return {Object} a request object that describes the segment/part to load
   */


  chooseNextRequest_() {
    const buffered = this.buffered_();
    const bufferedEnd = lastBufferedEnd(buffered) || 0;
    const bufferedTime = timeAheadOf(buffered, this.currentTime_());
    const preloaded = !this.hasPlayed_() && bufferedTime >= 1;
    const haveEnoughBuffer = bufferedTime >= this.goalBufferLength_();
    const segments = this.playlist_.segments; // return no segment if:
    // 1. we don't have segments
    // 2. The video has not yet played and we already downloaded a segment
    // 3. we already have enough buffered time

    if (!segments.length || preloaded || haveEnoughBuffer) {
      return null;
    }

    this.syncPoint_ = this.syncPoint_ || this.syncController_.getSyncPoint(this.playlist_, this.duration_(), this.currentTimeline_, this.currentTime_(), this.loaderType_);
    const next = {
      partIndex: null,
      mediaIndex: null,
      startOfSegment: null,
      playlist: this.playlist_,
      isSyncRequest: Boolean(!this.syncPoint_)
    };

    if (next.isSyncRequest) {
      next.mediaIndex = getSyncSegmentCandidate(this.currentTimeline_, segments, bufferedEnd);
      this.logger_(`choose next request. Can not find sync point. Fallback to media Index: ${next.mediaIndex}`);
    } else if (this.mediaIndex !== null) {
      const segment = segments[this.mediaIndex];
      const partIndex = typeof this.partIndex === 'number' ? this.partIndex : -1;
      next.startOfSegment = segment.end ? segment.end : bufferedEnd;

      if (segment.parts && segment.parts[partIndex + 1]) {
        next.mediaIndex = this.mediaIndex;
        next.partIndex = partIndex + 1;
      } else {
        next.mediaIndex = this.mediaIndex + 1;
      }
    } else {
      // Find the segment containing the end of the buffer or current time.
      const {
        segmentIndex,
        startTime,
        partIndex
      } = Playlist.getMediaInfoForTime({
        exactManifestTimings: this.exactManifestTimings,
        playlist: this.playlist_,
        currentTime: this.fetchAtBuffer_ ? bufferedEnd : this.currentTime_(),
        startingPartIndex: this.syncPoint_.partIndex,
        startingSegmentIndex: this.syncPoint_.segmentIndex,
        startTime: this.syncPoint_.time
      });
      next.getMediaInfoForTime = this.fetchAtBuffer_ ? `bufferedEnd ${bufferedEnd}` : `currentTime ${this.currentTime_()}`;
      next.mediaIndex = segmentIndex;
      next.startOfSegment = startTime;
      next.partIndex = partIndex;
      this.logger_(`choose next request. Playlist switched and we have a sync point. Media Index: ${next.mediaIndex} `);
    }

    const nextSegment = segments[next.mediaIndex];
    let nextPart = nextSegment && typeof next.partIndex === 'number' && nextSegment.parts && nextSegment.parts[next.partIndex]; // if the next segment index is invalid or
    // the next partIndex is invalid do not choose a next segment.

    if (!nextSegment || typeof next.partIndex === 'number' && !nextPart) {
      return null;
    } // if the next segment has parts, and we don't have a partIndex.
    // Set partIndex to 0


    if (typeof next.partIndex !== 'number' && nextSegment.parts) {
      next.partIndex = 0;
      nextPart = nextSegment.parts[0];
    } // independentSegments applies to every segment in a playlist. If independentSegments appears in a main playlist,
    // it applies to each segment in each media playlist.
    // https://datatracker.ietf.org/doc/html/draft-pantos-http-live-streaming-23#section-4.3.5.1


    const hasIndependentSegments = this.vhs_.playlists && this.vhs_.playlists.main && this.vhs_.playlists.main.independentSegments || this.playlist_.independentSegments; // if we have no buffered data then we need to make sure
    // that the next part we append is "independent" if possible.
    // So we check if the previous part is independent, and request
    // it if it is.

    if (!bufferedTime && nextPart && !hasIndependentSegments && !nextPart.independent) {
      if (next.partIndex === 0) {
        const lastSegment = segments[next.mediaIndex - 1];
        const lastSegmentLastPart = lastSegment.parts && lastSegment.parts.length && lastSegment.parts[lastSegment.parts.length - 1];

        if (lastSegmentLastPart && lastSegmentLastPart.independent) {
          next.mediaIndex -= 1;
          next.partIndex = lastSegment.parts.length - 1;
          next.independent = 'previous segment';
        }
      } else if (nextSegment.parts[next.partIndex - 1].independent) {
        next.partIndex -= 1;
        next.independent = 'previous part';
      }
    }

    const ended = this.mediaSource_ && this.mediaSource_.readyState === 'ended'; // do not choose a next segment if all of the following:
    // 1. this is the last segment in the playlist
    // 2. end of stream has been called on the media source already
    // 3. the player is not seeking

    if (next.mediaIndex >= segments.length - 1 && ended && !this.seeking_()) {
      return null;
    }

    if (this.shouldForceTimestampOffsetAfterResync_) {
      this.shouldForceTimestampOffsetAfterResync_ = false;
      next.forceTimestampOffset = true;
      this.logger_('choose next request. Force timestamp offset after loader resync');
    }

    return this.generateSegmentInfo_(next);
  }

  generateSegmentInfo_(options) {
    const {
      independent,
      playlist,
      mediaIndex,
      startOfSegment,
      isSyncRequest,
      partIndex,
      forceTimestampOffset,
      getMediaInfoForTime
    } = options;
    const segment = playlist.segments[mediaIndex];
    const part = typeof partIndex === 'number' && segment.parts[partIndex];
    const segmentInfo = {
      requestId: 'segment-loader-' + Math.random(),
      // resolve the segment URL relative to the playlist
      uri: part && part.resolvedUri || segment.resolvedUri,
      // the segment's mediaIndex at the time it was requested
      mediaIndex,
      partIndex: part ? partIndex : null,
      // whether or not to update the SegmentLoader's state with this
      // segment's mediaIndex
      isSyncRequest,
      startOfSegment,
      // the segment's playlist
      playlist,
      // unencrypted bytes of the segment
      bytes: null,
      // when a key is defined for this segment, the encrypted bytes
      encryptedBytes: null,
      // The target timestampOffset for this segment when we append it
      // to the source buffer
      timestampOffset: null,
      // The timeline that the segment is in
      timeline: segment.timeline,
      // The expected duration of the segment in seconds
      duration: part && part.duration || segment.duration,
      // retain the segment in case the playlist updates while doing an async process
      segment,
      part,
      byteLength: 0,
      transmuxer: this.transmuxer_,
      // type of getMediaInfoForTime that was used to get this segment
      getMediaInfoForTime,
      independent
    };
    const overrideCheck = typeof forceTimestampOffset !== 'undefined' ? forceTimestampOffset : this.isPendingTimestampOffset_;
    segmentInfo.timestampOffset = this.timestampOffsetForSegment_({
      segmentTimeline: segment.timeline,
      currentTimeline: this.currentTimeline_,
      startOfSegment,
      buffered: this.buffered_(),
      overrideCheck
    });
    const audioBufferedEnd = lastBufferedEnd(this.sourceUpdater_.audioBuffered());

    if (typeof audioBufferedEnd === 'number') {
      // since the transmuxer is using the actual timing values, but the buffer is
      // adjusted by the timestamp offset, we must adjust the value here
      segmentInfo.audioAppendStart = audioBufferedEnd - this.sourceUpdater_.audioTimestampOffset();
    }

    if (this.sourceUpdater_.videoBuffered().length) {
      segmentInfo.gopsToAlignWith = gopsSafeToAlignWith(this.gopBuffer_, // since the transmuxer is using the actual timing values, but the time is
      // adjusted by the timestmap offset, we must adjust the value here
      this.currentTime_() - this.sourceUpdater_.videoTimestampOffset(), this.timeMapping_);
    }

    return segmentInfo;
  } // get the timestampoffset for a segment,
  // added so that vtt segment loader can override and prevent
  // adding timestamp offsets.


  timestampOffsetForSegment_(options) {
    return timestampOffsetForSegment(options);
  }
  /**
   * Determines if the network has enough bandwidth to complete the current segment
   * request in a timely manner. If not, the request will be aborted early and bandwidth
   * updated to trigger a playlist switch.
   *
   * @param {Object} stats
   *        Object containing stats about the request timing and size
   * @private
   */


  earlyAbortWhenNeeded_(stats) {
    if (this.vhs_.tech_.paused() || // Don't abort if the current playlist is on the lowestEnabledRendition
    // TODO: Replace using timeout with a boolean indicating whether this playlist is
    //       the lowestEnabledRendition.
    !this.xhrOptions_.timeout || // Don't abort if we have no bandwidth information to estimate segment sizes
    !this.playlist_.attributes.BANDWIDTH) {
      return;
    } // Wait at least 1 second since the first byte of data has been received before
    // using the calculated bandwidth from the progress event to allow the bitrate
    // to stabilize


    if (Date.now() - (stats.firstBytesReceivedAt || Date.now()) < 1000) {
      return;
    }

    const currentTime = this.currentTime_();
    const measuredBandwidth = stats.bandwidth;
    const segmentDuration = this.pendingSegment_.duration;
    const requestTimeRemaining = Playlist.estimateSegmentRequestTime(segmentDuration, measuredBandwidth, this.playlist_, stats.bytesReceived); // Subtract 1 from the timeUntilRebuffer so we still consider an early abort
    // if we are only left with less than 1 second when the request completes.
    // A negative timeUntilRebuffering indicates we are already rebuffering

    const timeUntilRebuffer$1 = timeUntilRebuffer(this.buffered_(), currentTime, this.vhs_.tech_.playbackRate()) - 1; // Only consider aborting early if the estimated time to finish the download
    // is larger than the estimated time until the player runs out of forward buffer

    if (requestTimeRemaining <= timeUntilRebuffer$1) {
      return;
    }

    const switchCandidate = minRebufferMaxBandwidthSelector({
      main: this.vhs_.playlists.main,
      currentTime,
      bandwidth: measuredBandwidth,
      duration: this.duration_(),
      segmentDuration,
      timeUntilRebuffer: timeUntilRebuffer$1,
      currentTimeline: this.currentTimeline_,
      syncController: this.syncController_
    });

    if (!switchCandidate) {
      return;
    }

    const rebufferingImpact = requestTimeRemaining - timeUntilRebuffer$1;
    const timeSavedBySwitching = rebufferingImpact - switchCandidate.rebufferingImpact;
    let minimumTimeSaving = 0.5; // If we are already rebuffering, increase the amount of variance we add to the
    // potential round trip time of the new request so that we are not too aggressive
    // with switching to a playlist that might save us a fraction of a second.

    if (timeUntilRebuffer$1 <= TIME_FUDGE_FACTOR) {
      minimumTimeSaving = 1;
    }

    if (!switchCandidate.playlist || switchCandidate.playlist.uri === this.playlist_.uri || timeSavedBySwitching < minimumTimeSaving) {
      return;
    } // set the bandwidth to that of the desired playlist being sure to scale by
    // BANDWIDTH_VARIANCE and add one so the playlist selector does not exclude it
    // don't trigger a bandwidthupdate as the bandwidth is artifial


    this.bandwidth = switchCandidate.playlist.attributes.BANDWIDTH * Config.BANDWIDTH_VARIANCE + 1;
    this.trigger('earlyabort');
  }

  handleAbort_(segmentInfo) {
    this.logger_(`Aborting ${segmentInfoString(segmentInfo)}`);
    this.mediaRequestsAborted += 1;
  }
  /**
   * XHR `progress` event handler
   *
   * @param {Event}
   *        The XHR `progress` event
   * @param {Object} simpleSegment
   *        A simplified segment object copy
   * @private
   */


  handleProgress_(event, simpleSegment) {
    this.earlyAbortWhenNeeded_(simpleSegment.stats);

    if (this.checkForAbort_(simpleSegment.requestId)) {
      return;
    }

    this.trigger('progress');
  }

  handleTrackInfo_(simpleSegment, trackInfo) {
    this.earlyAbortWhenNeeded_(simpleSegment.stats);

    if (this.checkForAbort_(simpleSegment.requestId)) {
      return;
    }

    if (this.checkForIllegalMediaSwitch(trackInfo)) {
      return;
    }

    trackInfo = trackInfo || {}; // When we have track info, determine what media types this loader is dealing with.
    // Guard against cases where we're not getting track info at all until we are
    // certain that all streams will provide it.

    if (!shallowEqual(this.currentMediaInfo_, trackInfo)) {
      this.appendInitSegment_ = {
        audio: true,
        video: true
      };
      this.startingMediaInfo_ = trackInfo;
      this.currentMediaInfo_ = trackInfo;
      this.logger_('trackinfo update', trackInfo);
      this.trigger('trackinfo');
    } // trackinfo may cause an abort if the trackinfo
    // causes a codec change to an unsupported codec.


    if (this.checkForAbort_(simpleSegment.requestId)) {
      return;
    } // set trackinfo on the pending segment so that
    // it can append.


    this.pendingSegment_.trackInfo = trackInfo; // check if any calls were waiting on the track info

    if (this.hasEnoughInfoToAppend_()) {
      this.processCallQueue_();
    }
  }

  handleTimingInfo_(simpleSegment, mediaType, timeType, time) {
    this.earlyAbortWhenNeeded_(simpleSegment.stats);

    if (this.checkForAbort_(simpleSegment.requestId)) {
      return;
    }

    const segmentInfo = this.pendingSegment_;
    const timingInfoProperty = timingInfoPropertyForMedia(mediaType);
    segmentInfo[timingInfoProperty] = segmentInfo[timingInfoProperty] || {};
    segmentInfo[timingInfoProperty][timeType] = time;
    this.logger_(`timinginfo: ${mediaType} - ${timeType} - ${time}`); // check if any calls were waiting on the timing info

    if (this.hasEnoughInfoToAppend_()) {
      this.processCallQueue_();
    }
  }

  handleCaptions_(simpleSegment, captionData) {
    this.earlyAbortWhenNeeded_(simpleSegment.stats);

    if (this.checkForAbort_(simpleSegment.requestId)) {
      return;
    } // This could only happen with fmp4 segments, but
    // should still not happen in general


    if (captionData.length === 0) {
      this.logger_('SegmentLoader received no captions from a caption event');
      return;
    }

    const segmentInfo = this.pendingSegment_; // Wait until we have some video data so that caption timing
    // can be adjusted by the timestamp offset

    if (!segmentInfo.hasAppendedData_) {
      this.metadataQueue_.caption.push(this.handleCaptions_.bind(this, simpleSegment, captionData));
      return;
    }

    const timestampOffset = this.sourceUpdater_.videoTimestampOffset() === null ? this.sourceUpdater_.audioTimestampOffset() : this.sourceUpdater_.videoTimestampOffset();
    const captionTracks = {}; // get total start/end and captions for each track/stream

    captionData.forEach(caption => {
      // caption.stream is actually a track name...
      // set to the existing values in tracks or default values
      captionTracks[caption.stream] = captionTracks[caption.stream] || {
        // Infinity, as any other value will be less than this
        startTime: Infinity,
        captions: [],
        // 0 as an other value will be more than this
        endTime: 0
      };
      const captionTrack = captionTracks[caption.stream];
      captionTrack.startTime = Math.min(captionTrack.startTime, caption.startTime + timestampOffset);
      captionTrack.endTime = Math.max(captionTrack.endTime, caption.endTime + timestampOffset);
      captionTrack.captions.push(caption);
    });
    Object.keys(captionTracks).forEach(trackName => {
      const {
        startTime,
        endTime,
        captions
      } = captionTracks[trackName];
      const inbandTextTracks = this.inbandTextTracks_;
      this.logger_(`adding cues from ${startTime} -> ${endTime} for ${trackName}`);
      createCaptionsTrackIfNotExists(inbandTextTracks, this.vhs_.tech_, trackName); // clear out any cues that start and end at the same time period for the same track.
      // We do this because a rendition change that also changes the timescale for captions
      // will result in captions being re-parsed for certain segments. If we add them again
      // without clearing we will have two of the same captions visible.

      removeCuesFromTrack(startTime, endTime, inbandTextTracks[trackName]);
      addCaptionData({
        captionArray: captions,
        inbandTextTracks,
        timestampOffset
      });
    }); // Reset stored captions since we added parsed
    // captions to a text track at this point

    if (this.transmuxer_) {
      this.transmuxer_.postMessage({
        action: 'clearParsedMp4Captions'
      });
    }
  }

  handleId3_(simpleSegment, id3Frames, dispatchType) {
    this.earlyAbortWhenNeeded_(simpleSegment.stats);

    if (this.checkForAbort_(simpleSegment.requestId)) {
      return;
    }

    const segmentInfo = this.pendingSegment_; // we need to have appended data in order for the timestamp offset to be set

    if (!segmentInfo.hasAppendedData_) {
      this.metadataQueue_.id3.push(this.handleId3_.bind(this, simpleSegment, id3Frames, dispatchType));
      return;
    }

    this.addMetadataToTextTrack(dispatchType, id3Frames, this.duration_());
  }

  processMetadataQueue_() {
    this.metadataQueue_.id3.forEach(fn => fn());
    this.metadataQueue_.caption.forEach(fn => fn());
    this.metadataQueue_.id3 = [];
    this.metadataQueue_.caption = [];
  }

  processCallQueue_() {
    const callQueue = this.callQueue_; // Clear out the queue before the queued functions are run, since some of the
    // functions may check the length of the load queue and default to pushing themselves
    // back onto the queue.

    this.callQueue_ = [];
    callQueue.forEach(fun => fun());
  }

  processLoadQueue_() {
    const loadQueue = this.loadQueue_; // Clear out the queue before the queued functions are run, since some of the
    // functions may check the length of the load queue and default to pushing themselves
    // back onto the queue.

    this.loadQueue_ = [];
    loadQueue.forEach(fun => fun());
  }
  /**
   * Determines whether the loader has enough info to load the next segment.
   *
   * @return {boolean}
   *         Whether or not the loader has enough info to load the next segment
   */


  hasEnoughInfoToLoad_() {
    // Since primary timing goes by video, only the audio loader potentially needs to wait
    // to load.
    if (this.loaderType_ !== 'audio') {
      return true;
    }

    const segmentInfo = this.pendingSegment_; // A fill buffer must have already run to establish a pending segment before there's
    // enough info to load.

    if (!segmentInfo) {
      return false;
    } // The first segment can and should be loaded immediately so that source buffers are
    // created together (before appending). Source buffer creation uses the presence of
    // audio and video data to determine whether to create audio/video source buffers, and
    // uses processed (transmuxed or parsed) media to determine the types required.


    if (!this.getCurrentMediaInfo_()) {
      return true;
    }

    if ( // Technically, instead of waiting to load a segment on timeline changes, a segment
    // can be requested and downloaded and only wait before it is transmuxed or parsed.
    // But in practice, there are a few reasons why it is better to wait until a loader
    // is ready to append that segment before requesting and downloading:
    //
    // 1. Because audio and main loaders cross discontinuities together, if this loader
    //    is waiting for the other to catch up, then instead of requesting another
    //    segment and using up more bandwidth, by not yet loading, more bandwidth is
    //    allotted to the loader currently behind.
    // 2. media-segment-request doesn't have to have logic to consider whether a segment
    // is ready to be processed or not, isolating the queueing behavior to the loader.
    // 3. The audio loader bases some of its segment properties on timing information
    //    provided by the main loader, meaning that, if the logic for waiting on
    //    processing was in media-segment-request, then it would also need to know how
    //    to re-generate the segment information after the main loader caught up.
    shouldWaitForTimelineChange({
      timelineChangeController: this.timelineChangeController_,
      currentTimeline: this.currentTimeline_,
      segmentTimeline: segmentInfo.timeline,
      loaderType: this.loaderType_,
      audioDisabled: this.audioDisabled_
    })) {
      return false;
    }

    return true;
  }

  getCurrentMediaInfo_(segmentInfo = this.pendingSegment_) {
    return segmentInfo && segmentInfo.trackInfo || this.currentMediaInfo_;
  }

  getMediaInfo_(segmentInfo = this.pendingSegment_) {
    return this.getCurrentMediaInfo_(segmentInfo) || this.startingMediaInfo_;
  }

  getPendingSegmentPlaylist() {
    return this.pendingSegment_ ? this.pendingSegment_.playlist : null;
  }

  hasEnoughInfoToAppend_() {
    if (!this.sourceUpdater_.ready()) {
      return false;
    } // If content needs to be removed or the loader is waiting on an append reattempt,
    // then no additional content should be appended until the prior append is resolved.


    if (this.waitingOnRemove_ || this.quotaExceededErrorRetryTimeout_) {
      return false;
    }

    const segmentInfo = this.pendingSegment_;
    const trackInfo = this.getCurrentMediaInfo_(); // no segment to append any data for or
    // we do not have information on this specific
    // segment yet

    if (!segmentInfo || !trackInfo) {
      return false;
    }

    const {
      hasAudio,
      hasVideo,
      isMuxed
    } = trackInfo;

    if (hasVideo && !segmentInfo.videoTimingInfo) {
      return false;
    } // muxed content only relies on video timing information for now.


    if (hasAudio && !this.audioDisabled_ && !isMuxed && !segmentInfo.audioTimingInfo) {
      return false;
    }

    if (shouldWaitForTimelineChange({
      timelineChangeController: this.timelineChangeController_,
      currentTimeline: this.currentTimeline_,
      segmentTimeline: segmentInfo.timeline,
      loaderType: this.loaderType_,
      audioDisabled: this.audioDisabled_
    })) {
      return false;
    }

    return true;
  }

  handleData_(simpleSegment, result) {
    this.earlyAbortWhenNeeded_(simpleSegment.stats);

    if (this.checkForAbort_(simpleSegment.requestId)) {
      return;
    } // If there's anything in the call queue, then this data came later and should be
    // executed after the calls currently queued.


    if (this.callQueue_.length || !this.hasEnoughInfoToAppend_()) {
      this.callQueue_.push(this.handleData_.bind(this, simpleSegment, result));
      return;
    }

    const segmentInfo = this.pendingSegment_; // update the time mapping so we can translate from display time to media time

    this.setTimeMapping_(segmentInfo.timeline); // for tracking overall stats

    this.updateMediaSecondsLoaded_(segmentInfo.part || segmentInfo.segment); // Note that the state isn't changed from loading to appending. This is because abort
    // logic may change behavior depending on the state, and changing state too early may
    // inflate our estimates of bandwidth. In the future this should be re-examined to
    // note more granular states.
    // don't process and append data if the mediaSource is closed

    if (this.mediaSource_.readyState === 'closed') {
      return;
    } // if this request included an initialization segment, save that data
    // to the initSegment cache


    if (simpleSegment.map) {
      simpleSegment.map = this.initSegmentForMap(simpleSegment.map, true); // move over init segment properties to media request

      segmentInfo.segment.map = simpleSegment.map;
    } // if this request included a segment key, save that data in the cache


    if (simpleSegment.key) {
      this.segmentKey(simpleSegment.key, true);
    }

    segmentInfo.isFmp4 = simpleSegment.isFmp4;
    segmentInfo.timingInfo = segmentInfo.timingInfo || {};

    if (segmentInfo.isFmp4) {
      this.trigger('fmp4');
      segmentInfo.timingInfo.start = segmentInfo[timingInfoPropertyForMedia(result.type)].start;
    } else {
      const trackInfo = this.getCurrentMediaInfo_();
      const useVideoTimingInfo = this.loaderType_ === 'main' && trackInfo && trackInfo.hasVideo;
      let firstVideoFrameTimeForData;

      if (useVideoTimingInfo) {
        firstVideoFrameTimeForData = segmentInfo.videoTimingInfo.start;
      } // Segment loader knows more about segment timing than the transmuxer (in certain
      // aspects), so make any changes required for a more accurate start time.
      // Don't set the end time yet, as the segment may not be finished processing.


      segmentInfo.timingInfo.start = this.trueSegmentStart_({
        currentStart: segmentInfo.timingInfo.start,
        playlist: segmentInfo.playlist,
        mediaIndex: segmentInfo.mediaIndex,
        currentVideoTimestampOffset: this.sourceUpdater_.videoTimestampOffset(),
        useVideoTimingInfo,
        firstVideoFrameTimeForData,
        videoTimingInfo: segmentInfo.videoTimingInfo,
        audioTimingInfo: segmentInfo.audioTimingInfo
      });
    } // Init segments for audio and video only need to be appended in certain cases. Now
    // that data is about to be appended, we can check the final cases to determine
    // whether we should append an init segment.


    this.updateAppendInitSegmentStatus(segmentInfo, result.type); // Timestamp offset should be updated once we get new data and have its timing info,
    // as we use the start of the segment to offset the best guess (playlist provided)
    // timestamp offset.

    this.updateSourceBufferTimestampOffset_(segmentInfo); // if this is a sync request we need to determine whether it should
    // be appended or not.

    if (segmentInfo.isSyncRequest) {
      // first save/update our timing info for this segment.
      // this is what allows us to choose an accurate segment
      // and the main reason we make a sync request.
      this.updateTimingInfoEnd_(segmentInfo);
      this.syncController_.saveSegmentTimingInfo({
        segmentInfo,
        shouldSaveTimelineMapping: this.loaderType_ === 'main'
      });
      const next = this.chooseNextRequest_(); // If the sync request isn't the segment that would be requested next
      // after taking into account its timing info, do not append it.

      if (next.mediaIndex !== segmentInfo.mediaIndex || next.partIndex !== segmentInfo.partIndex) {
        this.logger_('sync segment was incorrect, not appending');
        return;
      } // otherwise append it like any other segment as our guess was correct.


      this.logger_('sync segment was correct, appending');
    } // Save some state so that in the future anything waiting on first append (and/or
    // timestamp offset(s)) can process immediately. While the extra state isn't optimal,
    // we need some notion of whether the timestamp offset or other relevant information
    // has had a chance to be set.


    segmentInfo.hasAppendedData_ = true; // Now that the timestamp offset should be set, we can append any waiting ID3 tags.

    this.processMetadataQueue_();
    this.appendData_(segmentInfo, result);
  }

  updateAppendInitSegmentStatus(segmentInfo, type) {
    // alt audio doesn't manage timestamp offset
    if (this.loaderType_ === 'main' && typeof segmentInfo.timestampOffset === 'number' && // in the case that we're handling partial data, we don't want to append an init
    // segment for each chunk
    !segmentInfo.changedTimestampOffset) {
      // if the timestamp offset changed, the timeline may have changed, so we have to re-
      // append init segments
      this.appendInitSegment_ = {
        audio: true,
        video: true
      };
    }

    if (this.playlistOfLastInitSegment_[type] !== segmentInfo.playlist) {
      // make sure we append init segment on playlist changes, in case the media config
      // changed
      this.appendInitSegment_[type] = true;
    }
  }

  getInitSegmentAndUpdateState_({
    type,
    initSegment,
    map,
    playlist
  }) {
    // "The EXT-X-MAP tag specifies how to obtain the Media Initialization Section
    // (Section 3) required to parse the applicable Media Segments.  It applies to every
    // Media Segment that appears after it in the Playlist until the next EXT-X-MAP tag
    // or until the end of the playlist."
    // https://tools.ietf.org/html/draft-pantos-http-live-streaming-23#section-4.3.2.5
    if (map) {
      const id = initSegmentId(map);

      if (this.activeInitSegmentId_ === id) {
        // don't need to re-append the init segment if the ID matches
        return null;
      } // a map-specified init segment takes priority over any transmuxed (or otherwise
      // obtained) init segment
      //
      // this also caches the init segment for later use


      initSegment = this.initSegmentForMap(map, true).bytes;
      this.activeInitSegmentId_ = id;
    } // We used to always prepend init segments for video, however, that shouldn't be
    // necessary. Instead, we should only append on changes, similar to what we've always
    // done for audio. This is more important (though may not be that important) for
    // frame-by-frame appending for LHLS, simply because of the increased quantity of
    // appends.


    if (initSegment && this.appendInitSegment_[type]) {
      // Make sure we track the playlist that we last used for the init segment, so that
      // we can re-append the init segment in the event that we get data from a new
      // playlist. Discontinuities and track changes are handled in other sections.
      this.playlistOfLastInitSegment_[type] = playlist; // Disable future init segment appends for this type. Until a change is necessary.

      this.appendInitSegment_[type] = false; // we need to clear out the fmp4 active init segment id, since
      // we are appending the muxer init segment

      this.activeInitSegmentId_ = null;
      return initSegment;
    }

    return null;
  }

  handleQuotaExceededError_({
    segmentInfo,
    type,
    bytes
  }, error) {
    const audioBuffered = this.sourceUpdater_.audioBuffered();
    const videoBuffered = this.sourceUpdater_.videoBuffered(); // For now we're ignoring any notion of gaps in the buffer, but they, in theory,
    // should be cleared out during the buffer removals. However, log in case it helps
    // debug.

    if (audioBuffered.length > 1) {
      this.logger_('On QUOTA_EXCEEDED_ERR, found gaps in the audio buffer: ' + timeRangesToArray(audioBuffered).join(', '));
    }

    if (videoBuffered.length > 1) {
      this.logger_('On QUOTA_EXCEEDED_ERR, found gaps in the video buffer: ' + timeRangesToArray(videoBuffered).join(', '));
    }

    const audioBufferStart = audioBuffered.length ? audioBuffered.start(0) : 0;
    const audioBufferEnd = audioBuffered.length ? audioBuffered.end(audioBuffered.length - 1) : 0;
    const videoBufferStart = videoBuffered.length ? videoBuffered.start(0) : 0;
    const videoBufferEnd = videoBuffered.length ? videoBuffered.end(videoBuffered.length - 1) : 0;

    if (audioBufferEnd - audioBufferStart <= MIN_BACK_BUFFER && videoBufferEnd - videoBufferStart <= MIN_BACK_BUFFER) {
      // Can't remove enough buffer to make room for new segment (or the browser doesn't
      // allow for appends of segments this size). In the future, it may be possible to
      // split up the segment and append in pieces, but for now, error out this playlist
      // in an attempt to switch to a more manageable rendition.
      this.logger_('On QUOTA_EXCEEDED_ERR, single segment too large to append to ' + 'buffer, triggering an error. ' + `Appended byte length: ${bytes.byteLength}, ` + `audio buffer: ${timeRangesToArray(audioBuffered).join(', ')}, ` + `video buffer: ${timeRangesToArray(videoBuffered).join(', ')}, `);
      this.error({
        message: 'Quota exceeded error with append of a single segment of content',
        excludeUntil: Infinity
      });
      this.trigger('error');
      return;
    } // To try to resolve the quota exceeded error, clear back buffer and retry. This means
    // that the segment-loader should block on future events until this one is handled, so
    // that it doesn't keep moving onto further segments. Adding the call to the call
    // queue will prevent further appends until waitingOnRemove_ and
    // quotaExceededErrorRetryTimeout_ are cleared.
    //
    // Note that this will only block the current loader. In the case of demuxed content,
    // the other load may keep filling as fast as possible. In practice, this should be
    // OK, as it is a rare case when either audio has a high enough bitrate to fill up a
    // source buffer, or video fills without enough room for audio to append (and without
    // the availability of clearing out seconds of back buffer to make room for audio).
    // But it might still be good to handle this case in the future as a TODO.


    this.waitingOnRemove_ = true;
    this.callQueue_.push(this.appendToSourceBuffer_.bind(this, {
      segmentInfo,
      type,
      bytes
    }));
    const currentTime = this.currentTime_(); // Try to remove as much audio and video as possible to make room for new content
    // before retrying.

    const timeToRemoveUntil = currentTime - MIN_BACK_BUFFER;
    this.logger_(`On QUOTA_EXCEEDED_ERR, removing audio/video from 0 to ${timeToRemoveUntil}`);
    this.remove(0, timeToRemoveUntil, () => {
      this.logger_(`On QUOTA_EXCEEDED_ERR, retrying append in ${MIN_BACK_BUFFER}s`);
      this.waitingOnRemove_ = false; // wait the length of time alotted in the back buffer to prevent wasted
      // attempts (since we can't clear less than the minimum)

      this.quotaExceededErrorRetryTimeout_ = window$1.setTimeout(() => {
        this.logger_('On QUOTA_EXCEEDED_ERR, re-processing call queue');
        this.quotaExceededErrorRetryTimeout_ = null;
        this.processCallQueue_();
      }, MIN_BACK_BUFFER * 1000);
    }, true);
  }

  handleAppendError_({
    segmentInfo,
    type,
    bytes
  }, error) {
    // if there's no error, nothing to do
    if (!error) {
      return;
    }

    if (error.code === QUOTA_EXCEEDED_ERR) {
      this.handleQuotaExceededError_({
        segmentInfo,
        type,
        bytes
      }); // A quota exceeded error should be recoverable with a future re-append, so no need
      // to trigger an append error.

      return;
    }

    this.logger_('Received non QUOTA_EXCEEDED_ERR on append', error);
    this.error(`${type} append of ${bytes.length}b failed for segment ` + `#${segmentInfo.mediaIndex} in playlist ${segmentInfo.playlist.id}`); // If an append errors, we often can't recover.
    // (see https://w3c.github.io/media-source/#sourcebuffer-append-error).
    //
    // Trigger a special error so that it can be handled separately from normal,
    // recoverable errors.

    this.trigger('appenderror');
  }

  appendToSourceBuffer_({
    segmentInfo,
    type,
    initSegment,
    data,
    bytes
  }) {
    // If this is a re-append, bytes were already created and don't need to be recreated
    if (!bytes) {
      const segments = [data];
      let byteLength = data.byteLength;

      if (initSegment) {
        // if the media initialization segment is changing, append it before the content
        // segment
        segments.unshift(initSegment);
        byteLength += initSegment.byteLength;
      } // Technically we should be OK appending the init segment separately, however, we
      // haven't yet tested that, and prepending is how we have always done things.


      bytes = concatSegments({
        bytes: byteLength,
        segments
      });
    }

    this.sourceUpdater_.appendBuffer({
      segmentInfo,
      type,
      bytes
    }, this.handleAppendError_.bind(this, {
      segmentInfo,
      type,
      bytes
    }));
  }

  handleSegmentTimingInfo_(type, requestId, segmentTimingInfo) {
    if (!this.pendingSegment_ || requestId !== this.pendingSegment_.requestId) {
      return;
    }

    const segment = this.pendingSegment_.segment;
    const timingInfoProperty = `${type}TimingInfo`;

    if (!segment[timingInfoProperty]) {
      segment[timingInfoProperty] = {};
    }

    segment[timingInfoProperty].transmuxerPrependedSeconds = segmentTimingInfo.prependedContentDuration || 0;
    segment[timingInfoProperty].transmuxedPresentationStart = segmentTimingInfo.start.presentation;
    segment[timingInfoProperty].transmuxedDecodeStart = segmentTimingInfo.start.decode;
    segment[timingInfoProperty].transmuxedPresentationEnd = segmentTimingInfo.end.presentation;
    segment[timingInfoProperty].transmuxedDecodeEnd = segmentTimingInfo.end.decode; // mainly used as a reference for debugging

    segment[timingInfoProperty].baseMediaDecodeTime = segmentTimingInfo.baseMediaDecodeTime;
  }

  appendData_(segmentInfo, result) {
    const {
      type,
      data
    } = result;

    if (!data || !data.byteLength) {
      return;
    }

    if (type === 'audio' && this.audioDisabled_) {
      return;
    }

    const initSegment = this.getInitSegmentAndUpdateState_({
      type,
      initSegment: result.initSegment,
      playlist: segmentInfo.playlist,
      map: segmentInfo.isFmp4 ? segmentInfo.segment.map : null
    });
    this.appendToSourceBuffer_({
      segmentInfo,
      type,
      initSegment,
      data
    });
  }
  /**
   * load a specific segment from a request into the buffer
   *
   * @private
   */


  loadSegment_(segmentInfo) {
    this.state = 'WAITING';
    this.pendingSegment_ = segmentInfo;
    this.trimBackBuffer_(segmentInfo);

    if (typeof segmentInfo.timestampOffset === 'number') {
      if (this.transmuxer_) {
        this.transmuxer_.postMessage({
          action: 'clearAllMp4Captions'
        });
      }
    }

    if (!this.hasEnoughInfoToLoad_()) {
      this.loadQueue_.push(() => {
        // regenerate the audioAppendStart, timestampOffset, etc as they
        // may have changed since this function was added to the queue.
        const options = _extends({}, segmentInfo, {
          forceTimestampOffset: true
        });

        _extends(segmentInfo, this.generateSegmentInfo_(options));

        this.isPendingTimestampOffset_ = false;
        this.updateTransmuxerAndRequestSegment_(segmentInfo);
      });
      return;
    }

    this.updateTransmuxerAndRequestSegment_(segmentInfo);
  }

  updateTransmuxerAndRequestSegment_(segmentInfo) {
    // We'll update the source buffer's timestamp offset once we have transmuxed data, but
    // the transmuxer still needs to be updated before then.
    //
    // Even though keepOriginalTimestamps is set to true for the transmuxer, timestamp
    // offset must be passed to the transmuxer for stream correcting adjustments.
    if (this.shouldUpdateTransmuxerTimestampOffset_(segmentInfo.timestampOffset)) {
      this.gopBuffer_.length = 0; // gopsToAlignWith was set before the GOP buffer was cleared

      segmentInfo.gopsToAlignWith = [];
      this.timeMapping_ = 0; // reset values in the transmuxer since a discontinuity should start fresh

      this.transmuxer_.postMessage({
        action: 'reset'
      });
      this.transmuxer_.postMessage({
        action: 'setTimestampOffset',
        timestampOffset: segmentInfo.timestampOffset
      });
    }

    const simpleSegment = this.createSimplifiedSegmentObj_(segmentInfo);
    const isEndOfStream = this.isEndOfStream_(segmentInfo.mediaIndex, segmentInfo.playlist, segmentInfo.partIndex);
    const isWalkingForward = this.mediaIndex !== null;
    const isDiscontinuity = segmentInfo.timeline !== this.currentTimeline_ && // currentTimeline starts at -1, so we shouldn't end the timeline switching to 0,
    // the first timeline
    segmentInfo.timeline > 0;
    const isEndOfTimeline = isEndOfStream || isWalkingForward && isDiscontinuity;
    this.logger_(`Requesting ${segmentInfoString(segmentInfo)}`); // If there's an init segment associated with this segment, but it is not cached (identified by a lack of bytes),
    // then this init segment has never been seen before and should be appended.
    //
    // At this point the content type (audio/video or both) is not yet known, but it should be safe to set
    // both to true and leave the decision of whether to append the init segment to append time.

    if (simpleSegment.map && !simpleSegment.map.bytes) {
      this.logger_('going to request init segment.');
      this.appendInitSegment_ = {
        video: true,
        audio: true
      };
    }

    segmentInfo.abortRequests = mediaSegmentRequest({
      xhr: this.vhs_.xhr,
      xhrOptions: this.xhrOptions_,
      decryptionWorker: this.decrypter_,
      segment: simpleSegment,
      abortFn: this.handleAbort_.bind(this, segmentInfo),
      progressFn: this.handleProgress_.bind(this),
      trackInfoFn: this.handleTrackInfo_.bind(this),
      timingInfoFn: this.handleTimingInfo_.bind(this),
      videoSegmentTimingInfoFn: this.handleSegmentTimingInfo_.bind(this, 'video', segmentInfo.requestId),
      audioSegmentTimingInfoFn: this.handleSegmentTimingInfo_.bind(this, 'audio', segmentInfo.requestId),
      captionsFn: this.handleCaptions_.bind(this),
      isEndOfTimeline,
      endedTimelineFn: () => {
        this.logger_('received endedtimeline callback');
      },
      id3Fn: this.handleId3_.bind(this),
      dataFn: this.handleData_.bind(this),
      doneFn: this.segmentRequestFinished_.bind(this),
      onTransmuxerLog: ({
        message,
        level,
        stream
      }) => {
        this.logger_(`${segmentInfoString(segmentInfo)} logged from transmuxer stream ${stream} as a ${level}: ${message}`);
      }
    });
  }
  /**
   * trim the back buffer so that we don't have too much data
   * in the source buffer
   *
   * @private
   *
   * @param {Object} segmentInfo - the current segment
   */


  trimBackBuffer_(segmentInfo) {
    const removeToTime = safeBackBufferTrimTime(this.seekable_(), this.currentTime_(), this.playlist_.targetDuration || 10); // Chrome has a hard limit of 150MB of
    // buffer and a very conservative "garbage collector"
    // We manually clear out the old buffer to ensure
    // we don't trigger the QuotaExceeded error
    // on the source buffer during subsequent appends

    if (removeToTime > 0) {
      this.remove(0, removeToTime);
    }
  }
  /**
   * created a simplified copy of the segment object with just the
   * information necessary to perform the XHR and decryption
   *
   * @private
   *
   * @param {Object} segmentInfo - the current segment
   * @return {Object} a simplified segment object copy
   */


  createSimplifiedSegmentObj_(segmentInfo) {
    const segment = segmentInfo.segment;
    const part = segmentInfo.part;
    const simpleSegment = {
      resolvedUri: part ? part.resolvedUri : segment.resolvedUri,
      byterange: part ? part.byterange : segment.byterange,
      requestId: segmentInfo.requestId,
      transmuxer: segmentInfo.transmuxer,
      audioAppendStart: segmentInfo.audioAppendStart,
      gopsToAlignWith: segmentInfo.gopsToAlignWith,
      part: segmentInfo.part
    };
    const previousSegment = segmentInfo.playlist.segments[segmentInfo.mediaIndex - 1];

    if (previousSegment && previousSegment.timeline === segment.timeline) {
      // The baseStartTime of a segment is used to handle rollover when probing the TS
      // segment to retrieve timing information. Since the probe only looks at the media's
      // times (e.g., PTS and DTS values of the segment), and doesn't consider the
      // player's time (e.g., player.currentTime()), baseStartTime should reflect the
      // media time as well. transmuxedDecodeEnd represents the end time of a segment, in
      // seconds of media time, so should be used here. The previous segment is used since
      // the end of the previous segment should represent the beginning of the current
      // segment, so long as they are on the same timeline.
      if (previousSegment.videoTimingInfo) {
        simpleSegment.baseStartTime = previousSegment.videoTimingInfo.transmuxedDecodeEnd;
      } else if (previousSegment.audioTimingInfo) {
        simpleSegment.baseStartTime = previousSegment.audioTimingInfo.transmuxedDecodeEnd;
      }
    }

    if (segment.key) {
      // if the media sequence is greater than 2^32, the IV will be incorrect
      // assuming 10s segments, that would be about 1300 years
      const iv = segment.key.iv || new Uint32Array([0, 0, 0, segmentInfo.mediaIndex + segmentInfo.playlist.mediaSequence]);
      simpleSegment.key = this.segmentKey(segment.key);
      simpleSegment.key.iv = iv;
    }

    if (segment.map) {
      simpleSegment.map = this.initSegmentForMap(segment.map);
    }

    return simpleSegment;
  }

  saveTransferStats_(stats) {
    // every request counts as a media request even if it has been aborted
    // or canceled due to a timeout
    this.mediaRequests += 1;

    if (stats) {
      this.mediaBytesTransferred += stats.bytesReceived;
      this.mediaTransferDuration += stats.roundTripTime;
    }
  }

  saveBandwidthRelatedStats_(duration, stats) {
    // byteLength will be used for throughput, and should be based on bytes receieved,
    // which we only know at the end of the request and should reflect total bytes
    // downloaded rather than just bytes processed from components of the segment
    this.pendingSegment_.byteLength = stats.bytesReceived;

    if (duration < MIN_SEGMENT_DURATION_TO_SAVE_STATS) {
      this.logger_(`Ignoring segment's bandwidth because its duration of ${duration}` + ` is less than the min to record ${MIN_SEGMENT_DURATION_TO_SAVE_STATS}`);
      return;
    }

    this.bandwidth = stats.bandwidth;
    this.roundTrip = stats.roundTripTime;
  }

  handleTimeout_() {
    // although the VTT segment loader bandwidth isn't really used, it's good to
    // maintain functinality between segment loaders
    this.mediaRequestsTimedout += 1;
    this.bandwidth = 1;
    this.roundTrip = NaN;
    this.trigger('bandwidthupdate');
    this.trigger('timeout');
  }
  /**
   * Handle the callback from the segmentRequest function and set the
   * associated SegmentLoader state and errors if necessary
   *
   * @private
   */


  segmentRequestFinished_(error, simpleSegment, result) {
    // TODO handle special cases, e.g., muxed audio/video but only audio in the segment
    // check the call queue directly since this function doesn't need to deal with any
    // data, and can continue even if the source buffers are not set up and we didn't get
    // any data from the segment
    if (this.callQueue_.length) {
      this.callQueue_.push(this.segmentRequestFinished_.bind(this, error, simpleSegment, result));
      return;
    }

    this.saveTransferStats_(simpleSegment.stats); // The request was aborted and the SegmentLoader has already been reset

    if (!this.pendingSegment_) {
      return;
    } // the request was aborted and the SegmentLoader has already started
    // another request. this can happen when the timeout for an aborted
    // request triggers due to a limitation in the XHR library
    // do not count this as any sort of request or we risk double-counting


    if (simpleSegment.requestId !== this.pendingSegment_.requestId) {
      return;
    } // an error occurred from the active pendingSegment_ so reset everything


    if (error) {
      this.pendingSegment_ = null;
      this.state = 'READY'; // aborts are not a true error condition and nothing corrective needs to be done

      if (error.code === REQUEST_ERRORS.ABORTED) {
        return;
      }

      this.pause(); // the error is really just that at least one of the requests timed-out
      // set the bandwidth to a very low value and trigger an ABR switch to
      // take emergency action

      if (error.code === REQUEST_ERRORS.TIMEOUT) {
        this.handleTimeout_();
        return;
      } // if control-flow has arrived here, then the error is real
      // emit an error event to exclude the current playlist


      this.mediaRequestsErrored += 1;
      this.error(error);
      this.trigger('error');
      return;
    }

    const segmentInfo = this.pendingSegment_; // the response was a success so set any bandwidth stats the request
    // generated for ABR purposes

    this.saveBandwidthRelatedStats_(segmentInfo.duration, simpleSegment.stats);
    segmentInfo.endOfAllRequests = simpleSegment.endOfAllRequests;

    if (result.gopInfo) {
      this.gopBuffer_ = updateGopBuffer(this.gopBuffer_, result.gopInfo, this.safeAppend_);
    } // Although we may have already started appending on progress, we shouldn't switch the
    // state away from loading until we are officially done loading the segment data.


    this.state = 'APPENDING'; // used for testing

    this.trigger('appending');
    this.waitForAppendsToComplete_(segmentInfo);
  }

  setTimeMapping_(timeline) {
    const timelineMapping = this.syncController_.mappingForTimeline(timeline);

    if (timelineMapping !== null) {
      this.timeMapping_ = timelineMapping;
    }
  }

  updateMediaSecondsLoaded_(segment) {
    if (typeof segment.start === 'number' && typeof segment.end === 'number') {
      this.mediaSecondsLoaded += segment.end - segment.start;
    } else {
      this.mediaSecondsLoaded += segment.duration;
    }
  }

  shouldUpdateTransmuxerTimestampOffset_(timestampOffset) {
    if (timestampOffset === null) {
      return false;
    } // note that we're potentially using the same timestamp offset for both video and
    // audio


    if (this.loaderType_ === 'main' && timestampOffset !== this.sourceUpdater_.videoTimestampOffset()) {
      return true;
    }

    if (!this.audioDisabled_ && timestampOffset !== this.sourceUpdater_.audioTimestampOffset()) {
      return true;
    }

    return false;
  }

  trueSegmentStart_({
    currentStart,
    playlist,
    mediaIndex,
    firstVideoFrameTimeForData,
    currentVideoTimestampOffset,
    useVideoTimingInfo,
    videoTimingInfo,
    audioTimingInfo
  }) {
    if (typeof currentStart !== 'undefined') {
      // if start was set once, keep using it
      return currentStart;
    }

    if (!useVideoTimingInfo) {
      return audioTimingInfo.start;
    }

    const previousSegment = playlist.segments[mediaIndex - 1]; // The start of a segment should be the start of the first full frame contained
    // within that segment. Since the transmuxer maintains a cache of incomplete data
    // from and/or the last frame seen, the start time may reflect a frame that starts
    // in the previous segment. Check for that case and ensure the start time is
    // accurate for the segment.

    if (mediaIndex === 0 || !previousSegment || typeof previousSegment.start === 'undefined' || previousSegment.end !== firstVideoFrameTimeForData + currentVideoTimestampOffset) {
      return firstVideoFrameTimeForData;
    }

    return videoTimingInfo.start;
  }

  waitForAppendsToComplete_(segmentInfo) {
    const trackInfo = this.getCurrentMediaInfo_(segmentInfo);

    if (!trackInfo) {
      this.error({
        message: 'No starting media returned, likely due to an unsupported media format.',
        playlistExclusionDuration: Infinity
      });
      this.trigger('error');
      return;
    } // Although transmuxing is done, appends may not yet be finished. Throw a marker
    // on each queue this loader is responsible for to ensure that the appends are
    // complete.


    const {
      hasAudio,
      hasVideo,
      isMuxed
    } = trackInfo;
    const waitForVideo = this.loaderType_ === 'main' && hasVideo;
    const waitForAudio = !this.audioDisabled_ && hasAudio && !isMuxed;
    segmentInfo.waitingOnAppends = 0; // segments with no data

    if (!segmentInfo.hasAppendedData_) {
      if (!segmentInfo.timingInfo && typeof segmentInfo.timestampOffset === 'number') {
        // When there's no audio or video data in the segment, there's no audio or video
        // timing information.
        //
        // If there's no audio or video timing information, then the timestamp offset
        // can't be adjusted to the appropriate value for the transmuxer and source
        // buffers.
        //
        // Therefore, the next segment should be used to set the timestamp offset.
        this.isPendingTimestampOffset_ = true;
      } // override settings for metadata only segments


      segmentInfo.timingInfo = {
        start: 0
      };
      segmentInfo.waitingOnAppends++;

      if (!this.isPendingTimestampOffset_) {
        // update the timestampoffset
        this.updateSourceBufferTimestampOffset_(segmentInfo); // make sure the metadata queue is processed even though we have
        // no video/audio data.

        this.processMetadataQueue_();
      } // append is "done" instantly with no data.


      this.checkAppendsDone_(segmentInfo);
      return;
    } // Since source updater could call back synchronously, do the increments first.


    if (waitForVideo) {
      segmentInfo.waitingOnAppends++;
    }

    if (waitForAudio) {
      segmentInfo.waitingOnAppends++;
    }

    if (waitForVideo) {
      this.sourceUpdater_.videoQueueCallback(this.checkAppendsDone_.bind(this, segmentInfo));
    }

    if (waitForAudio) {
      this.sourceUpdater_.audioQueueCallback(this.checkAppendsDone_.bind(this, segmentInfo));
    }
  }

  checkAppendsDone_(segmentInfo) {
    if (this.checkForAbort_(segmentInfo.requestId)) {
      return;
    }

    segmentInfo.waitingOnAppends--;

    if (segmentInfo.waitingOnAppends === 0) {
      this.handleAppendsDone_();
    }
  }

  checkForIllegalMediaSwitch(trackInfo) {
    const illegalMediaSwitchError = illegalMediaSwitch(this.loaderType_, this.getCurrentMediaInfo_(), trackInfo);

    if (illegalMediaSwitchError) {
      this.error({
        message: illegalMediaSwitchError,
        playlistExclusionDuration: Infinity
      });
      this.trigger('error');
      return true;
    }

    return false;
  }

  updateSourceBufferTimestampOffset_(segmentInfo) {
    if (segmentInfo.timestampOffset === null || // we don't yet have the start for whatever media type (video or audio) has
    // priority, timing-wise, so we must wait
    typeof segmentInfo.timingInfo.start !== 'number' || // already updated the timestamp offset for this segment
    segmentInfo.changedTimestampOffset || // the alt audio loader should not be responsible for setting the timestamp offset
    this.loaderType_ !== 'main') {
      return;
    }

    let didChange = false; // Primary timing goes by video, and audio is trimmed in the transmuxer, meaning that
    // the timing info here comes from video. In the event that the audio is longer than
    // the video, this will trim the start of the audio.
    // This also trims any offset from 0 at the beginning of the media

    segmentInfo.timestampOffset -= this.getSegmentStartTimeForTimestampOffsetCalculation_({
      videoTimingInfo: segmentInfo.segment.videoTimingInfo,
      audioTimingInfo: segmentInfo.segment.audioTimingInfo,
      timingInfo: segmentInfo.timingInfo
    }); // In the event that there are part segment downloads, each will try to update the
    // timestamp offset. Retaining this bit of state prevents us from updating in the
    // future (within the same segment), however, there may be a better way to handle it.

    segmentInfo.changedTimestampOffset = true;

    if (segmentInfo.timestampOffset !== this.sourceUpdater_.videoTimestampOffset()) {
      this.sourceUpdater_.videoTimestampOffset(segmentInfo.timestampOffset);
      didChange = true;
    }

    if (segmentInfo.timestampOffset !== this.sourceUpdater_.audioTimestampOffset()) {
      this.sourceUpdater_.audioTimestampOffset(segmentInfo.timestampOffset);
      didChange = true;
    }

    if (didChange) {
      this.trigger('timestampoffset');
    }
  }

  getSegmentStartTimeForTimestampOffsetCalculation_({
    videoTimingInfo,
    audioTimingInfo,
    timingInfo
  }) {
    if (!this.useDtsForTimestampOffset_) {
      return timingInfo.start;
    }

    if (videoTimingInfo && typeof videoTimingInfo.transmuxedDecodeStart === 'number') {
      return videoTimingInfo.transmuxedDecodeStart;
    } // handle audio only


    if (audioTimingInfo && typeof audioTimingInfo.transmuxedDecodeStart === 'number') {
      return audioTimingInfo.transmuxedDecodeStart;
    } // handle content not transmuxed (e.g., MP4)


    return timingInfo.start;
  }

  updateTimingInfoEnd_(segmentInfo) {
    segmentInfo.timingInfo = segmentInfo.timingInfo || {};
    const trackInfo = this.getMediaInfo_();
    const useVideoTimingInfo = this.loaderType_ === 'main' && trackInfo && trackInfo.hasVideo;
    const prioritizedTimingInfo = useVideoTimingInfo && segmentInfo.videoTimingInfo ? segmentInfo.videoTimingInfo : segmentInfo.audioTimingInfo;

    if (!prioritizedTimingInfo) {
      return;
    }

    segmentInfo.timingInfo.end = typeof prioritizedTimingInfo.end === 'number' ? // End time may not exist in a case where we aren't parsing the full segment (one
    // current example is the case of fmp4), so use the rough duration to calculate an
    // end time.
    prioritizedTimingInfo.end : prioritizedTimingInfo.start + segmentInfo.duration;
  }
  /**
   * callback to run when appendBuffer is finished. detects if we are
   * in a good state to do things with the data we got, or if we need
   * to wait for more
   *
   * @private
   */


  handleAppendsDone_() {
    // appendsdone can cause an abort
    if (this.pendingSegment_) {
      this.trigger('appendsdone');
    }

    if (!this.pendingSegment_) {
      this.state = 'READY'; // TODO should this move into this.checkForAbort to speed up requests post abort in
      // all appending cases?

      if (!this.paused()) {
        this.monitorBuffer_();
      }

      return;
    }

    const segmentInfo = this.pendingSegment_; // Now that the end of the segment has been reached, we can set the end time. It's
    // best to wait until all appends are done so we're sure that the primary media is
    // finished (and we have its end time).

    this.updateTimingInfoEnd_(segmentInfo);

    if (this.shouldSaveSegmentTimingInfo_) {
      // Timeline mappings should only be saved for the main loader. This is for multiple
      // reasons:
      //
      // 1) Only one mapping is saved per timeline, meaning that if both the audio loader
      //    and the main loader try to save the timeline mapping, whichever comes later
      //    will overwrite the first. In theory this is OK, as the mappings should be the
      //    same, however, it breaks for (2)
      // 2) In the event of a live stream, the initial live point will make for a somewhat
      //    arbitrary mapping. If audio and video streams are not perfectly in-sync, then
      //    the mapping will be off for one of the streams, dependent on which one was
      //    first saved (see (1)).
      // 3) Primary timing goes by video in VHS, so the mapping should be video.
      //
      // Since the audio loader will wait for the main loader to load the first segment,
      // the main loader will save the first timeline mapping, and ensure that there won't
      // be a case where audio loads two segments without saving a mapping (thus leading
      // to missing segment timing info).
      this.syncController_.saveSegmentTimingInfo({
        segmentInfo,
        shouldSaveTimelineMapping: this.loaderType_ === 'main'
      });
    }

    const segmentDurationMessage = getTroublesomeSegmentDurationMessage(segmentInfo, this.sourceType_);

    if (segmentDurationMessage) {
      if (segmentDurationMessage.severity === 'warn') {
        videojs.log.warn(segmentDurationMessage.message);
      } else {
        this.logger_(segmentDurationMessage.message);
      }
    }

    this.recordThroughput_(segmentInfo);
    this.pendingSegment_ = null;
    this.state = 'READY';

    if (segmentInfo.isSyncRequest) {
      this.trigger('syncinfoupdate'); // if the sync request was not appended
      // then it was not the correct segment.
      // throw it away and use the data it gave us
      // to get the correct one.

      if (!segmentInfo.hasAppendedData_) {
        this.logger_(`Throwing away un-appended sync request ${segmentInfoString(segmentInfo)}`);
        return;
      }
    }

    this.logger_(`Appended ${segmentInfoString(segmentInfo)}`);
    this.addSegmentMetadataCue_(segmentInfo);
    this.fetchAtBuffer_ = true;

    if (this.currentTimeline_ !== segmentInfo.timeline) {
      this.timelineChangeController_.lastTimelineChange({
        type: this.loaderType_,
        from: this.currentTimeline_,
        to: segmentInfo.timeline
      }); // If audio is not disabled, the main segment loader is responsible for updating
      // the audio timeline as well. If the content is video only, this won't have any
      // impact.

      if (this.loaderType_ === 'main' && !this.audioDisabled_) {
        this.timelineChangeController_.lastTimelineChange({
          type: 'audio',
          from: this.currentTimeline_,
          to: segmentInfo.timeline
        });
      }
    }

    this.currentTimeline_ = segmentInfo.timeline; // We must update the syncinfo to recalculate the seekable range before
    // the following conditional otherwise it may consider this a bad "guess"
    // and attempt to resync when the post-update seekable window and live
    // point would mean that this was the perfect segment to fetch

    this.trigger('syncinfoupdate');
    const segment = segmentInfo.segment;
    const part = segmentInfo.part;
    const badSegmentGuess = segment.end && this.currentTime_() - segment.end > segmentInfo.playlist.targetDuration * 3;
    const badPartGuess = part && part.end && this.currentTime_() - part.end > segmentInfo.playlist.partTargetDuration * 3; // If we previously appended a segment/part that ends more than 3 part/targetDurations before
    // the currentTime_ that means that our conservative guess was too conservative.
    // In that case, reset the loader state so that we try to use any information gained
    // from the previous request to create a new, more accurate, sync-point.

    if (badSegmentGuess || badPartGuess) {
      this.logger_(`bad ${badSegmentGuess ? 'segment' : 'part'} ${segmentInfoString(segmentInfo)}`);
      this.resetEverything();
      return;
    }

    const isWalkingForward = this.mediaIndex !== null; // Don't do a rendition switch unless we have enough time to get a sync segment
    // and conservatively guess

    if (isWalkingForward) {
      this.trigger('bandwidthupdate');
    }

    this.trigger('progress');
    this.mediaIndex = segmentInfo.mediaIndex;
    this.partIndex = segmentInfo.partIndex; // any time an update finishes and the last segment is in the
    // buffer, end the stream. this ensures the "ended" event will
    // fire if playback reaches that point.

    if (this.isEndOfStream_(segmentInfo.mediaIndex, segmentInfo.playlist, segmentInfo.partIndex)) {
      this.endOfStream();
    } // used for testing


    this.trigger('appended');

    if (segmentInfo.hasAppendedData_) {
      this.mediaAppends++;
    }

    if (!this.paused()) {
      this.monitorBuffer_();
    }
  }
  /**
   * Records the current throughput of the decrypt, transmux, and append
   * portion of the semgment pipeline. `throughput.rate` is a the cumulative
   * moving average of the throughput. `throughput.count` is the number of
   * data points in the average.
   *
   * @private
   * @param {Object} segmentInfo the object returned by loadSegment
   */


  recordThroughput_(segmentInfo) {
    if (segmentInfo.duration < MIN_SEGMENT_DURATION_TO_SAVE_STATS) {
      this.logger_(`Ignoring segment's throughput because its duration of ${segmentInfo.duration}` + ` is less than the min to record ${MIN_SEGMENT_DURATION_TO_SAVE_STATS}`);
      return;
    }

    const rate = this.throughput.rate; // Add one to the time to ensure that we don't accidentally attempt to divide
    // by zero in the case where the throughput is ridiculously high

    const segmentProcessingTime = Date.now() - segmentInfo.endOfAllRequests + 1; // Multiply by 8000 to convert from bytes/millisecond to bits/second

    const segmentProcessingThroughput = Math.floor(segmentInfo.byteLength / segmentProcessingTime * 8 * 1000); // This is just a cumulative moving average calculation:
    //   newAvg = oldAvg + (sample - oldAvg) / (sampleCount + 1)

    this.throughput.rate += (segmentProcessingThroughput - rate) / ++this.throughput.count;
  }
  /**
   * Adds a cue to the segment-metadata track with some metadata information about the
   * segment
   *
   * @private
   * @param {Object} segmentInfo
   *        the object returned by loadSegment
   * @method addSegmentMetadataCue_
   */


  addSegmentMetadataCue_(segmentInfo) {
    if (!this.segmentMetadataTrack_) {
      return;
    }

    const segment = segmentInfo.segment;
    const start = segment.start;
    const end = segment.end; // Do not try adding the cue if the start and end times are invalid.

    if (!finite(start) || !finite(end)) {
      return;
    }

    removeCuesFromTrack(start, end, this.segmentMetadataTrack_);
    const Cue = window$1.WebKitDataCue || window$1.VTTCue;
    const value = {
      custom: segment.custom,
      dateTimeObject: segment.dateTimeObject,
      dateTimeString: segment.dateTimeString,
      programDateTime: segment.programDateTime,
      bandwidth: segmentInfo.playlist.attributes.BANDWIDTH,
      resolution: segmentInfo.playlist.attributes.RESOLUTION,
      codecs: segmentInfo.playlist.attributes.CODECS,
      byteLength: segmentInfo.byteLength,
      uri: segmentInfo.uri,
      timeline: segmentInfo.timeline,
      playlist: segmentInfo.playlist.id,
      start,
      end
    };
    const data = JSON.stringify(value);
    const cue = new Cue(start, end, data); // Attach the metadata to the value property of the cue to keep consistency between
    // the differences of WebKitDataCue in safari and VTTCue in other browsers

    cue.value = value;
    this.segmentMetadataTrack_.addCue(cue);
  }

}

function noop() {}

const toTitleCase = function (string) {
  if (typeof string !== 'string') {
    return string;
  }

  return string.replace(/./, w => w.toUpperCase());
};

/**
 * @file source-updater.js
 */
const bufferTypes = ['video', 'audio'];

const updating = (type, sourceUpdater) => {
  const sourceBuffer = sourceUpdater[`${type}Buffer`];
  return sourceBuffer && sourceBuffer.updating || sourceUpdater.queuePending[type];
};

const nextQueueIndexOfType = (type, queue) => {
  for (let i = 0; i < queue.length; i++) {
    const queueEntry = queue[i];

    if (queueEntry.type === 'mediaSource') {
      // If the next entry is a media source entry (uses multiple source buffers), block
      // processing to allow it to go through first.
      return null;
    }

    if (queueEntry.type === type) {
      return i;
    }
  }

  return null;
};

const shiftQueue = (type, sourceUpdater) => {
  if (sourceUpdater.queue.length === 0) {
    return;
  }

  let queueIndex = 0;
  let queueEntry = sourceUpdater.queue[queueIndex];

  if (queueEntry.type === 'mediaSource') {
    if (!sourceUpdater.updating() && sourceUpdater.mediaSource.readyState !== 'closed') {
      sourceUpdater.queue.shift();
      queueEntry.action(sourceUpdater);

      if (queueEntry.doneFn) {
        queueEntry.doneFn();
      } // Only specific source buffer actions must wait for async updateend events. Media
      // Source actions process synchronously. Therefore, both audio and video source
      // buffers are now clear to process the next queue entries.


      shiftQueue('audio', sourceUpdater);
      shiftQueue('video', sourceUpdater);
    } // Media Source actions require both source buffers, so if the media source action
    // couldn't process yet (because one or both source buffers are busy), block other
    // queue actions until both are available and the media source action can process.


    return;
  }

  if (type === 'mediaSource') {
    // If the queue was shifted by a media source action (this happens when pushing a
    // media source action onto the queue), then it wasn't from an updateend event from an
    // audio or video source buffer, so there's no change from previous state, and no
    // processing should be done.
    return;
  } // Media source queue entries don't need to consider whether the source updater is
  // started (i.e., source buffers are created) as they don't need the source buffers, but
  // source buffer queue entries do.


  if (!sourceUpdater.ready() || sourceUpdater.mediaSource.readyState === 'closed' || updating(type, sourceUpdater)) {
    return;
  }

  if (queueEntry.type !== type) {
    queueIndex = nextQueueIndexOfType(type, sourceUpdater.queue);

    if (queueIndex === null) {
      // Either there's no queue entry that uses this source buffer type in the queue, or
      // there's a media source queue entry before the next entry of this type, in which
      // case wait for that action to process first.
      return;
    }

    queueEntry = sourceUpdater.queue[queueIndex];
  }

  sourceUpdater.queue.splice(queueIndex, 1); // Keep a record that this source buffer type is in use.
  //
  // The queue pending operation must be set before the action is performed in the event
  // that the action results in a synchronous event that is acted upon. For instance, if
  // an exception is thrown that can be handled, it's possible that new actions will be
  // appended to an empty queue and immediately executed, but would not have the correct
  // pending information if this property was set after the action was performed.

  sourceUpdater.queuePending[type] = queueEntry;
  queueEntry.action(type, sourceUpdater);

  if (!queueEntry.doneFn) {
    // synchronous operation, process next entry
    sourceUpdater.queuePending[type] = null;
    shiftQueue(type, sourceUpdater);
    return;
  }
};

const cleanupBuffer = (type, sourceUpdater) => {
  const buffer = sourceUpdater[`${type}Buffer`];
  const titleType = toTitleCase(type);

  if (!buffer) {
    return;
  }

  buffer.removeEventListener('updateend', sourceUpdater[`on${titleType}UpdateEnd_`]);
  buffer.removeEventListener('error', sourceUpdater[`on${titleType}Error_`]);
  sourceUpdater.codecs[type] = null;
  sourceUpdater[`${type}Buffer`] = null;
};

const inSourceBuffers = (mediaSource, sourceBuffer) => mediaSource && sourceBuffer && Array.prototype.indexOf.call(mediaSource.sourceBuffers, sourceBuffer) !== -1;

const actions = {
  appendBuffer: (bytes, segmentInfo, onError) => (type, sourceUpdater) => {
    const sourceBuffer = sourceUpdater[`${type}Buffer`]; // can't do anything if the media source / source buffer is null
    // or the media source does not contain this source buffer.

    if (!inSourceBuffers(sourceUpdater.mediaSource, sourceBuffer)) {
      return;
    }

    sourceUpdater.logger_(`Appending segment ${segmentInfo.mediaIndex}'s ${bytes.length} bytes to ${type}Buffer`);

    try {
      sourceBuffer.appendBuffer(bytes);
    } catch (e) {
      sourceUpdater.logger_(`Error with code ${e.code} ` + (e.code === QUOTA_EXCEEDED_ERR ? '(QUOTA_EXCEEDED_ERR) ' : '') + `when appending segment ${segmentInfo.mediaIndex} to ${type}Buffer`);
      sourceUpdater.queuePending[type] = null;
      onError(e);
    }
  },
  remove: (start, end) => (type, sourceUpdater) => {
    const sourceBuffer = sourceUpdater[`${type}Buffer`]; // can't do anything if the media source / source buffer is null
    // or the media source does not contain this source buffer.

    if (!inSourceBuffers(sourceUpdater.mediaSource, sourceBuffer)) {
      return;
    }

    sourceUpdater.logger_(`Removing ${start} to ${end} from ${type}Buffer`);

    try {
      sourceBuffer.remove(start, end);
    } catch (e) {
      sourceUpdater.logger_(`Remove ${start} to ${end} from ${type}Buffer failed`);
    }
  },
  timestampOffset: offset => (type, sourceUpdater) => {
    const sourceBuffer = sourceUpdater[`${type}Buffer`]; // can't do anything if the media source / source buffer is null
    // or the media source does not contain this source buffer.

    if (!inSourceBuffers(sourceUpdater.mediaSource, sourceBuffer)) {
      return;
    }

    sourceUpdater.logger_(`Setting ${type}timestampOffset to ${offset}`);
    sourceBuffer.timestampOffset = offset;
  },
  callback: callback => (type, sourceUpdater) => {
    callback();
  },
  endOfStream: error => sourceUpdater => {
    if (sourceUpdater.mediaSource.readyState !== 'open') {
      return;
    }

    sourceUpdater.logger_(`Calling mediaSource endOfStream(${error || ''})`);

    try {
      sourceUpdater.mediaSource.endOfStream(error);
    } catch (e) {
      videojs.log.warn('Failed to call media source endOfStream', e);
    }
  },
  duration: duration => sourceUpdater => {
    sourceUpdater.logger_(`Setting mediaSource duration to ${duration}`);

    try {
      sourceUpdater.mediaSource.duration = duration;
    } catch (e) {
      videojs.log.warn('Failed to set media source duration', e);
    }
  },
  abort: () => (type, sourceUpdater) => {
    if (sourceUpdater.mediaSource.readyState !== 'open') {
      return;
    }

    const sourceBuffer = sourceUpdater[`${type}Buffer`]; // can't do anything if the media source / source buffer is null
    // or the media source does not contain this source buffer.

    if (!inSourceBuffers(sourceUpdater.mediaSource, sourceBuffer)) {
      return;
    }

    sourceUpdater.logger_(`calling abort on ${type}Buffer`);

    try {
      sourceBuffer.abort();
    } catch (e) {
      videojs.log.warn(`Failed to abort on ${type}Buffer`, e);
    }
  },
  addSourceBuffer: (type, codec) => sourceUpdater => {
    const titleType = toTitleCase(type);
    const mime = getMimeForCodec(codec);
    sourceUpdater.logger_(`Adding ${type}Buffer with codec ${codec} to mediaSource`);
    const sourceBuffer = sourceUpdater.mediaSource.addSourceBuffer(mime);
    sourceBuffer.addEventListener('updateend', sourceUpdater[`on${titleType}UpdateEnd_`]);
    sourceBuffer.addEventListener('error', sourceUpdater[`on${titleType}Error_`]);
    sourceUpdater.codecs[type] = codec;
    sourceUpdater[`${type}Buffer`] = sourceBuffer;
  },
  removeSourceBuffer: type => sourceUpdater => {
    const sourceBuffer = sourceUpdater[`${type}Buffer`];
    cleanupBuffer(type, sourceUpdater); // can't do anything if the media source / source buffer is null
    // or the media source does not contain this source buffer.

    if (!inSourceBuffers(sourceUpdater.mediaSource, sourceBuffer)) {
      return;
    }

    sourceUpdater.logger_(`Removing ${type}Buffer with codec ${sourceUpdater.codecs[type]} from mediaSource`);

    try {
      sourceUpdater.mediaSource.removeSourceBuffer(sourceBuffer);
    } catch (e) {
      videojs.log.warn(`Failed to removeSourceBuffer ${type}Buffer`, e);
    }
  },
  changeType: codec => (type, sourceUpdater) => {
    const sourceBuffer = sourceUpdater[`${type}Buffer`];
    const mime = getMimeForCodec(codec); // can't do anything if the media source / source buffer is null
    // or the media source does not contain this source buffer.

    if (!inSourceBuffers(sourceUpdater.mediaSource, sourceBuffer)) {
      return;
    } // do not update codec if we don't need to.


    if (sourceUpdater.codecs[type] === codec) {
      return;
    }

    sourceUpdater.logger_(`changing ${type}Buffer codec from ${sourceUpdater.codecs[type]} to ${codec}`);
    sourceBuffer.changeType(mime);
    sourceUpdater.codecs[type] = codec;
  }
};

const pushQueue = ({
  type,
  sourceUpdater,
  action,
  doneFn,
  name
}) => {
  sourceUpdater.queue.push({
    type,
    action,
    doneFn,
    name
  });
  shiftQueue(type, sourceUpdater);
};

const onUpdateend = (type, sourceUpdater) => e => {
  // Although there should, in theory, be a pending action for any updateend receieved,
  // there are some actions that may trigger updateend events without set definitions in
  // the w3c spec. For instance, setting the duration on the media source may trigger
  // updateend events on source buffers. This does not appear to be in the spec. As such,
  // if we encounter an updateend without a corresponding pending action from our queue
  // for that source buffer type, process the next action.
  if (sourceUpdater.queuePending[type]) {
    const doneFn = sourceUpdater.queuePending[type].doneFn;
    sourceUpdater.queuePending[type] = null;

    if (doneFn) {
      // if there's an error, report it
      doneFn(sourceUpdater[`${type}Error_`]);
    }
  }

  shiftQueue(type, sourceUpdater);
};
/**
 * A queue of callbacks to be serialized and applied when a
 * MediaSource and its associated SourceBuffers are not in the
 * updating state. It is used by the segment loader to update the
 * underlying SourceBuffers when new data is loaded, for instance.
 *
 * @class SourceUpdater
 * @param {MediaSource} mediaSource the MediaSource to create the SourceBuffer from
 * @param {string} mimeType the desired MIME type of the underlying SourceBuffer
 */


class SourceUpdater extends videojs.EventTarget {
  constructor(mediaSource) {
    super();
    this.mediaSource = mediaSource;

    this.sourceopenListener_ = () => shiftQueue('mediaSource', this);

    this.mediaSource.addEventListener('sourceopen', this.sourceopenListener_);
    this.logger_ = logger('SourceUpdater'); // initial timestamp offset is 0

    this.audioTimestampOffset_ = 0;
    this.videoTimestampOffset_ = 0;
    this.queue = [];
    this.queuePending = {
      audio: null,
      video: null
    };
    this.delayedAudioAppendQueue_ = [];
    this.videoAppendQueued_ = false;
    this.codecs = {};
    this.onVideoUpdateEnd_ = onUpdateend('video', this);
    this.onAudioUpdateEnd_ = onUpdateend('audio', this);

    this.onVideoError_ = e => {
      // used for debugging
      this.videoError_ = e;
    };

    this.onAudioError_ = e => {
      // used for debugging
      this.audioError_ = e;
    };

    this.createdSourceBuffers_ = false;
    this.initializedEme_ = false;
    this.triggeredReady_ = false;
  }

  initializedEme() {
    this.initializedEme_ = true;
    this.triggerReady();
  }

  hasCreatedSourceBuffers() {
    // if false, likely waiting on one of the segment loaders to get enough data to create
    // source buffers
    return this.createdSourceBuffers_;
  }

  hasInitializedAnyEme() {
    return this.initializedEme_;
  }

  ready() {
    return this.hasCreatedSourceBuffers() && this.hasInitializedAnyEme();
  }

  createSourceBuffers(codecs) {
    if (this.hasCreatedSourceBuffers()) {
      // already created them before
      return;
    } // the intial addOrChangeSourceBuffers will always be
    // two add buffers.


    this.addOrChangeSourceBuffers(codecs);
    this.createdSourceBuffers_ = true;
    this.trigger('createdsourcebuffers');
    this.triggerReady();
  }

  triggerReady() {
    // only allow ready to be triggered once, this prevents the case
    // where:
    // 1. we trigger createdsourcebuffers
    // 2. ie 11 synchronously initializates eme
    // 3. the synchronous initialization causes us to trigger ready
    // 4. We go back to the ready check in createSourceBuffers and ready is triggered again.
    if (this.ready() && !this.triggeredReady_) {
      this.triggeredReady_ = true;
      this.trigger('ready');
    }
  }
  /**
   * Add a type of source buffer to the media source.
   *
   * @param {string} type
   *        The type of source buffer to add.
   *
   * @param {string} codec
   *        The codec to add the source buffer with.
   */


  addSourceBuffer(type, codec) {
    pushQueue({
      type: 'mediaSource',
      sourceUpdater: this,
      action: actions.addSourceBuffer(type, codec),
      name: 'addSourceBuffer'
    });
  }
  /**
   * call abort on a source buffer.
   *
   * @param {string} type
   *        The type of source buffer to call abort on.
   */


  abort(type) {
    pushQueue({
      type,
      sourceUpdater: this,
      action: actions.abort(type),
      name: 'abort'
    });
  }
  /**
   * Call removeSourceBuffer and remove a specific type
   * of source buffer on the mediaSource.
   *
   * @param {string} type
   *        The type of source buffer to remove.
   */


  removeSourceBuffer(type) {
    if (!this.canRemoveSourceBuffer()) {
      videojs.log.error('removeSourceBuffer is not supported!');
      return;
    }

    pushQueue({
      type: 'mediaSource',
      sourceUpdater: this,
      action: actions.removeSourceBuffer(type),
      name: 'removeSourceBuffer'
    });
  }
  /**
   * Whether or not the removeSourceBuffer function is supported
   * on the mediaSource.
   *
   * @return {boolean}
   *          if removeSourceBuffer can be called.
   */


  canRemoveSourceBuffer() {
    // As of Firefox 83 removeSourceBuffer
    // throws errors, so we report that it does not support this.
    return !videojs.browser.IS_FIREFOX && window$1.MediaSource && window$1.MediaSource.prototype && typeof window$1.MediaSource.prototype.removeSourceBuffer === 'function';
  }
  /**
   * Whether or not the changeType function is supported
   * on our SourceBuffers.
   *
   * @return {boolean}
   *         if changeType can be called.
   */


  static canChangeType() {
    return window$1.SourceBuffer && window$1.SourceBuffer.prototype && typeof window$1.SourceBuffer.prototype.changeType === 'function';
  }
  /**
   * Whether or not the changeType function is supported
   * on our SourceBuffers.
   *
   * @return {boolean}
   *         if changeType can be called.
   */


  canChangeType() {
    return this.constructor.canChangeType();
  }
  /**
   * Call the changeType function on a source buffer, given the code and type.
   *
   * @param {string} type
   *        The type of source buffer to call changeType on.
   *
   * @param {string} codec
   *        The codec string to change type with on the source buffer.
   */


  changeType(type, codec) {
    if (!this.canChangeType()) {
      videojs.log.error('changeType is not supported!');
      return;
    }

    pushQueue({
      type,
      sourceUpdater: this,
      action: actions.changeType(codec),
      name: 'changeType'
    });
  }
  /**
   * Add source buffers with a codec or, if they are already created,
   * call changeType on source buffers using changeType.
   *
   * @param {Object} codecs
   *        Codecs to switch to
   */


  addOrChangeSourceBuffers(codecs) {
    if (!codecs || typeof codecs !== 'object' || Object.keys(codecs).length === 0) {
      throw new Error('Cannot addOrChangeSourceBuffers to undefined codecs');
    }

    Object.keys(codecs).forEach(type => {
      const codec = codecs[type];

      if (!this.hasCreatedSourceBuffers()) {
        return this.addSourceBuffer(type, codec);
      }

      if (this.canChangeType()) {
        this.changeType(type, codec);
      }
    });
  }
  /**
   * Queue an update to append an ArrayBuffer.
   *
   * @param {MediaObject} object containing audioBytes and/or videoBytes
   * @param {Function} done the function to call when done
   * @see http://www.w3.org/TR/media-source/#widl-SourceBuffer-appendBuffer-void-ArrayBuffer-data
   */


  appendBuffer(options, doneFn) {
    const {
      segmentInfo,
      type,
      bytes
    } = options;
    this.processedAppend_ = true;

    if (type === 'audio' && this.videoBuffer && !this.videoAppendQueued_) {
      this.delayedAudioAppendQueue_.push([options, doneFn]);
      this.logger_(`delayed audio append of ${bytes.length} until video append`);
      return;
    } // In the case of certain errors, for instance, QUOTA_EXCEEDED_ERR, updateend will
    // not be fired. This means that the queue will be blocked until the next action
    // taken by the segment-loader. Provide a mechanism for segment-loader to handle
    // these errors by calling the doneFn with the specific error.


    const onError = doneFn;
    pushQueue({
      type,
      sourceUpdater: this,
      action: actions.appendBuffer(bytes, segmentInfo || {
        mediaIndex: -1
      }, onError),
      doneFn,
      name: 'appendBuffer'
    });

    if (type === 'video') {
      this.videoAppendQueued_ = true;

      if (!this.delayedAudioAppendQueue_.length) {
        return;
      }

      const queue = this.delayedAudioAppendQueue_.slice();
      this.logger_(`queuing delayed audio ${queue.length} appendBuffers`);
      this.delayedAudioAppendQueue_.length = 0;
      queue.forEach(que => {
        this.appendBuffer.apply(this, que);
      });
    }
  }
  /**
   * Get the audio buffer's buffered timerange.
   *
   * @return {TimeRange}
   *         The audio buffer's buffered time range
   */


  audioBuffered() {
    // no media source/source buffer or it isn't in the media sources
    // source buffer list
    if (!inSourceBuffers(this.mediaSource, this.audioBuffer)) {
      return createTimeRanges();
    }

    return this.audioBuffer.buffered ? this.audioBuffer.buffered : createTimeRanges();
  }
  /**
   * Get the video buffer's buffered timerange.
   *
   * @return {TimeRange}
   *         The video buffer's buffered time range
   */


  videoBuffered() {
    // no media source/source buffer or it isn't in the media sources
    // source buffer list
    if (!inSourceBuffers(this.mediaSource, this.videoBuffer)) {
      return createTimeRanges();
    }

    return this.videoBuffer.buffered ? this.videoBuffer.buffered : createTimeRanges();
  }
  /**
   * Get a combined video/audio buffer's buffered timerange.
   *
   * @return {TimeRange}
   *         the combined time range
   */


  buffered() {
    const video = inSourceBuffers(this.mediaSource, this.videoBuffer) ? this.videoBuffer : null;
    const audio = inSourceBuffers(this.mediaSource, this.audioBuffer) ? this.audioBuffer : null;

    if (audio && !video) {
      return this.audioBuffered();
    }

    if (video && !audio) {
      return this.videoBuffered();
    }

    return bufferIntersection(this.audioBuffered(), this.videoBuffered());
  }
  /**
   * Add a callback to the queue that will set duration on the mediaSource.
   *
   * @param {number} duration
   *        The duration to set
   *
   * @param {Function} [doneFn]
   *        function to run after duration has been set.
   */


  setDuration(duration, doneFn = noop) {
    // In order to set the duration on the media source, it's necessary to wait for all
    // source buffers to no longer be updating. "If the updating attribute equals true on
    // any SourceBuffer in sourceBuffers, then throw an InvalidStateError exception and
    // abort these steps." (source: https://www.w3.org/TR/media-source/#attributes).
    pushQueue({
      type: 'mediaSource',
      sourceUpdater: this,
      action: actions.duration(duration),
      name: 'duration',
      doneFn
    });
  }
  /**
   * Add a mediaSource endOfStream call to the queue
   *
   * @param {Error} [error]
   *        Call endOfStream with an error
   *
   * @param {Function} [doneFn]
   *        A function that should be called when the
   *        endOfStream call has finished.
   */


  endOfStream(error = null, doneFn = noop) {
    if (typeof error !== 'string') {
      error = undefined;
    } // In order to set the duration on the media source, it's necessary to wait for all
    // source buffers to no longer be updating. "If the updating attribute equals true on
    // any SourceBuffer in sourceBuffers, then throw an InvalidStateError exception and
    // abort these steps." (source: https://www.w3.org/TR/media-source/#attributes).


    pushQueue({
      type: 'mediaSource',
      sourceUpdater: this,
      action: actions.endOfStream(error),
      name: 'endOfStream',
      doneFn
    });
  }
  /**
   * Queue an update to remove a time range from the buffer.
   *
   * @param {number} start where to start the removal
   * @param {number} end where to end the removal
   * @param {Function} [done=noop] optional callback to be executed when the remove
   * operation is complete
   * @see http://www.w3.org/TR/media-source/#widl-SourceBuffer-remove-void-double-start-unrestricted-double-end
   */


  removeAudio(start, end, done = noop) {
    if (!this.audioBuffered().length || this.audioBuffered().end(0) === 0) {
      done();
      return;
    }

    pushQueue({
      type: 'audio',
      sourceUpdater: this,
      action: actions.remove(start, end),
      doneFn: done,
      name: 'remove'
    });
  }
  /**
   * Queue an update to remove a time range from the buffer.
   *
   * @param {number} start where to start the removal
   * @param {number} end where to end the removal
   * @param {Function} [done=noop] optional callback to be executed when the remove
   * operation is complete
   * @see http://www.w3.org/TR/media-source/#widl-SourceBuffer-remove-void-double-start-unrestricted-double-end
   */


  removeVideo(start, end, done = noop) {
    if (!this.videoBuffered().length || this.videoBuffered().end(0) === 0) {
      done();
      return;
    }

    pushQueue({
      type: 'video',
      sourceUpdater: this,
      action: actions.remove(start, end),
      doneFn: done,
      name: 'remove'
    });
  }
  /**
   * Whether the underlying sourceBuffer is updating or not
   *
   * @return {boolean} the updating status of the SourceBuffer
   */


  updating() {
    // the audio/video source buffer is updating
    if (updating('audio', this) || updating('video', this)) {
      return true;
    }

    return false;
  }
  /**
   * Set/get the timestampoffset on the audio SourceBuffer
   *
   * @return {number} the timestamp offset
   */


  audioTimestampOffset(offset) {
    if (typeof offset !== 'undefined' && this.audioBuffer && // no point in updating if it's the same
    this.audioTimestampOffset_ !== offset) {
      pushQueue({
        type: 'audio',
        sourceUpdater: this,
        action: actions.timestampOffset(offset),
        name: 'timestampOffset'
      });
      this.audioTimestampOffset_ = offset;
    }

    return this.audioTimestampOffset_;
  }
  /**
   * Set/get the timestampoffset on the video SourceBuffer
   *
   * @return {number} the timestamp offset
   */


  videoTimestampOffset(offset) {
    if (typeof offset !== 'undefined' && this.videoBuffer && // no point in updating if it's the same
    this.videoTimestampOffset !== offset) {
      pushQueue({
        type: 'video',
        sourceUpdater: this,
        action: actions.timestampOffset(offset),
        name: 'timestampOffset'
      });
      this.videoTimestampOffset_ = offset;
    }

    return this.videoTimestampOffset_;
  }
  /**
   * Add a function to the queue that will be called
   * when it is its turn to run in the audio queue.
   *
   * @param {Function} callback
   *        The callback to queue.
   */


  audioQueueCallback(callback) {
    if (!this.audioBuffer) {
      return;
    }

    pushQueue({
      type: 'audio',
      sourceUpdater: this,
      action: actions.callback(callback),
      name: 'callback'
    });
  }
  /**
   * Add a function to the queue that will be called
   * when it is its turn to run in the video queue.
   *
   * @param {Function} callback
   *        The callback to queue.
   */


  videoQueueCallback(callback) {
    if (!this.videoBuffer) {
      return;
    }

    pushQueue({
      type: 'video',
      sourceUpdater: this,
      action: actions.callback(callback),
      name: 'callback'
    });
  }
  /**
   * dispose of the source updater and the underlying sourceBuffer
   */


  dispose() {
    this.trigger('dispose');
    bufferTypes.forEach(type => {
      this.abort(type);

      if (this.canRemoveSourceBuffer()) {
        this.removeSourceBuffer(type);
      } else {
        this[`${type}QueueCallback`](() => cleanupBuffer(type, this));
      }
    });
    this.videoAppendQueued_ = false;
    this.delayedAudioAppendQueue_.length = 0;

    if (this.sourceopenListener_) {
      this.mediaSource.removeEventListener('sourceopen', this.sourceopenListener_);
    }

    this.off();
  }

}

const uint8ToUtf8 = uintArray => decodeURIComponent(escape(String.fromCharCode.apply(null, uintArray)));
const bufferToHexString = buffer => {
  const uInt8Buffer = new Uint8Array(buffer);
  return Array.from(uInt8Buffer).map(byte => byte.toString(16).padStart(2, '0')).join('');
};

/**
 * @file vtt-segment-loader.js
 */
const VTT_LINE_TERMINATORS = new Uint8Array('\n\n'.split('').map(char => char.charCodeAt(0)));

class NoVttJsError extends Error {
  constructor() {
    super('Trying to parse received VTT cues, but there is no WebVTT. Make sure vtt.js is loaded.');
  }

}
/**
 * An object that manages segment loading and appending.
 *
 * @class VTTSegmentLoader
 * @param {Object} options required and optional options
 * @extends videojs.EventTarget
 */


class VTTSegmentLoader extends SegmentLoader {
  constructor(settings, options = {}) {
    super(settings, options); // SegmentLoader requires a MediaSource be specified or it will throw an error;
    // however, VTTSegmentLoader has no need of a media source, so delete the reference

    this.mediaSource_ = null;
    this.subtitlesTrack_ = null;
    this.loaderType_ = 'subtitle';
    this.featuresNativeTextTracks_ = settings.featuresNativeTextTracks;
    this.loadVttJs = settings.loadVttJs; // The VTT segment will have its own time mappings. Saving VTT segment timing info in
    // the sync controller leads to improper behavior.

    this.shouldSaveSegmentTimingInfo_ = false;
  }

  createTransmuxer_() {
    // don't need to transmux any subtitles
    return null;
  }
  /**
   * Indicates which time ranges are buffered
   *
   * @return {TimeRange}
   *         TimeRange object representing the current buffered ranges
   */


  buffered_() {
    if (!this.subtitlesTrack_ || !this.subtitlesTrack_.cues || !this.subtitlesTrack_.cues.length) {
      return createTimeRanges();
    }

    const cues = this.subtitlesTrack_.cues;
    const start = cues[0].startTime;
    const end = cues[cues.length - 1].startTime;
    return createTimeRanges([[start, end]]);
  }
  /**
   * Gets and sets init segment for the provided map
   *
   * @param {Object} map
   *        The map object representing the init segment to get or set
   * @param {boolean=} set
   *        If true, the init segment for the provided map should be saved
   * @return {Object}
   *         map object for desired init segment
   */


  initSegmentForMap(map, set = false) {
    if (!map) {
      return null;
    }

    const id = initSegmentId(map);
    let storedMap = this.initSegments_[id];

    if (set && !storedMap && map.bytes) {
      // append WebVTT line terminators to the media initialization segment if it exists
      // to follow the WebVTT spec (https://w3c.github.io/webvtt/#file-structure) that
      // requires two or more WebVTT line terminators between the WebVTT header and the
      // rest of the file
      const combinedByteLength = VTT_LINE_TERMINATORS.byteLength + map.bytes.byteLength;
      const combinedSegment = new Uint8Array(combinedByteLength);
      combinedSegment.set(map.bytes);
      combinedSegment.set(VTT_LINE_TERMINATORS, map.bytes.byteLength);
      this.initSegments_[id] = storedMap = {
        resolvedUri: map.resolvedUri,
        byterange: map.byterange,
        bytes: combinedSegment
      };
    }

    return storedMap || map;
  }
  /**
   * Returns true if all configuration required for loading is present, otherwise false.
   *
   * @return {boolean} True if the all configuration is ready for loading
   * @private
   */


  couldBeginLoading_() {
    return this.playlist_ && this.subtitlesTrack_ && !this.paused();
  }
  /**
   * Once all the starting parameters have been specified, begin
   * operation. This method should only be invoked from the INIT
   * state.
   *
   * @private
   */


  init_() {
    this.state = 'READY';
    this.resetEverything();
    return this.monitorBuffer_();
  }
  /**
   * Set a subtitle track on the segment loader to add subtitles to
   *
   * @param {TextTrack=} track
   *        The text track to add loaded subtitles to
   * @return {TextTrack}
   *        Returns the subtitles track
   */


  track(track) {
    if (typeof track === 'undefined') {
      return this.subtitlesTrack_;
    }

    this.subtitlesTrack_ = track; // if we were unpaused but waiting for a sourceUpdater, start
    // buffering now

    if (this.state === 'INIT' && this.couldBeginLoading_()) {
      this.init_();
    }

    return this.subtitlesTrack_;
  }
  /**
   * Remove any data in the source buffer between start and end times
   *
   * @param {number} start - the start time of the region to remove from the buffer
   * @param {number} end - the end time of the region to remove from the buffer
   */


  remove(start, end) {
    removeCuesFromTrack(start, end, this.subtitlesTrack_);
  }
  /**
   * fill the buffer with segements unless the sourceBuffers are
   * currently updating
   *
   * Note: this function should only ever be called by monitorBuffer_
   * and never directly
   *
   * @private
   */


  fillBuffer_() {
    // see if we need to begin loading immediately
    const segmentInfo = this.chooseNextRequest_();

    if (!segmentInfo) {
      return;
    }

    if (this.syncController_.timestampOffsetForTimeline(segmentInfo.timeline) === null) {
      // We don't have the timestamp offset that we need to sync subtitles.
      // Rerun on a timestamp offset or user interaction.
      const checkTimestampOffset = () => {
        this.state = 'READY';

        if (!this.paused()) {
          // if not paused, queue a buffer check as soon as possible
          this.monitorBuffer_();
        }
      };

      this.syncController_.one('timestampoffset', checkTimestampOffset);
      this.state = 'WAITING_ON_TIMELINE';
      return;
    }

    this.loadSegment_(segmentInfo);
  } // never set a timestamp offset for vtt segments.


  timestampOffsetForSegment_() {
    return null;
  }

  chooseNextRequest_() {
    return this.skipEmptySegments_(super.chooseNextRequest_());
  }
  /**
   * Prevents the segment loader from requesting segments we know contain no subtitles
   * by walking forward until we find the next segment that we don't know whether it is
   * empty or not.
   *
   * @param {Object} segmentInfo
   *        a segment info object that describes the current segment
   * @return {Object}
   *         a segment info object that describes the current segment
   */


  skipEmptySegments_(segmentInfo) {
    while (segmentInfo && segmentInfo.segment.empty) {
      // stop at the last possible segmentInfo
      if (segmentInfo.mediaIndex + 1 >= segmentInfo.playlist.segments.length) {
        segmentInfo = null;
        break;
      }

      segmentInfo = this.generateSegmentInfo_({
        playlist: segmentInfo.playlist,
        mediaIndex: segmentInfo.mediaIndex + 1,
        startOfSegment: segmentInfo.startOfSegment + segmentInfo.duration,
        isSyncRequest: segmentInfo.isSyncRequest
      });
    }

    return segmentInfo;
  }

  stopForError(error) {
    this.error(error);
    this.state = 'READY';
    this.pause();
    this.trigger('error');
  }
  /**
   * append a decrypted segement to the SourceBuffer through a SourceUpdater
   *
   * @private
   */


  segmentRequestFinished_(error, simpleSegment, result) {
    if (!this.subtitlesTrack_) {
      this.state = 'READY';
      return;
    }

    this.saveTransferStats_(simpleSegment.stats); // the request was aborted

    if (!this.pendingSegment_) {
      this.state = 'READY';
      this.mediaRequestsAborted += 1;
      return;
    }

    if (error) {
      if (error.code === REQUEST_ERRORS.TIMEOUT) {
        this.handleTimeout_();
      }

      if (error.code === REQUEST_ERRORS.ABORTED) {
        this.mediaRequestsAborted += 1;
      } else {
        this.mediaRequestsErrored += 1;
      }

      this.stopForError(error);
      return;
    }

    const segmentInfo = this.pendingSegment_; // although the VTT segment loader bandwidth isn't really used, it's good to
    // maintain functionality between segment loaders

    this.saveBandwidthRelatedStats_(segmentInfo.duration, simpleSegment.stats); // if this request included a segment key, save that data in the cache

    if (simpleSegment.key) {
      this.segmentKey(simpleSegment.key, true);
    }

    this.state = 'APPENDING'; // used for tests

    this.trigger('appending');
    const segment = segmentInfo.segment;

    if (segment.map) {
      segment.map.bytes = simpleSegment.map.bytes;
    }

    segmentInfo.bytes = simpleSegment.bytes; // Make sure that vttjs has loaded, otherwise, load it and wait till it finished loading

    if (typeof window$1.WebVTT !== 'function' && typeof this.loadVttJs === 'function') {
      this.state = 'WAITING_ON_VTTJS'; // should be fine to call multiple times
      // script will be loaded once but multiple listeners will be added to the queue, which is expected.

      this.loadVttJs().then(() => this.segmentRequestFinished_(error, simpleSegment, result), () => this.stopForError({
        message: 'Error loading vtt.js'
      }));
      return;
    }

    segment.requested = true;

    try {
      this.parseVTTCues_(segmentInfo);
    } catch (e) {
      this.stopForError({
        message: e.message
      });
      return;
    }

    this.updateTimeMapping_(segmentInfo, this.syncController_.timelines[segmentInfo.timeline], this.playlist_);

    if (segmentInfo.cues.length) {
      segmentInfo.timingInfo = {
        start: segmentInfo.cues[0].startTime,
        end: segmentInfo.cues[segmentInfo.cues.length - 1].endTime
      };
    } else {
      segmentInfo.timingInfo = {
        start: segmentInfo.startOfSegment,
        end: segmentInfo.startOfSegment + segmentInfo.duration
      };
    }

    if (segmentInfo.isSyncRequest) {
      this.trigger('syncinfoupdate');
      this.pendingSegment_ = null;
      this.state = 'READY';
      return;
    }

    segmentInfo.byteLength = segmentInfo.bytes.byteLength;
    this.mediaSecondsLoaded += segment.duration; // Create VTTCue instances for each cue in the new segment and add them to
    // the subtitle track

    segmentInfo.cues.forEach(cue => {
      this.subtitlesTrack_.addCue(this.featuresNativeTextTracks_ ? new window$1.VTTCue(cue.startTime, cue.endTime, cue.text) : cue);
    }); // Remove any duplicate cues from the subtitle track. The WebVTT spec allows
    // cues to have identical time-intervals, but if the text is also identical
    // we can safely assume it is a duplicate that can be removed (ex. when a cue
    // "overlaps" VTT segments)

    removeDuplicateCuesFromTrack(this.subtitlesTrack_);
    this.handleAppendsDone_();
  }

  handleData_() {// noop as we shouldn't be getting video/audio data captions
    // that we do not support here.
  }

  updateTimingInfoEnd_() {// noop
  }
  /**
   * Uses the WebVTT parser to parse the segment response
   *
   * @throws NoVttJsError
   *
   * @param {Object} segmentInfo
   *        a segment info object that describes the current segment
   * @private
   */


  parseVTTCues_(segmentInfo) {
    let decoder;
    let decodeBytesToString = false;

    if (typeof window$1.WebVTT !== 'function') {
      // caller is responsible for exception handling.
      throw new NoVttJsError();
    }

    if (typeof window$1.TextDecoder === 'function') {
      decoder = new window$1.TextDecoder('utf8');
    } else {
      decoder = window$1.WebVTT.StringDecoder();
      decodeBytesToString = true;
    }

    const parser = new window$1.WebVTT.Parser(window$1, window$1.vttjs, decoder);
    segmentInfo.cues = [];
    segmentInfo.timestampmap = {
      MPEGTS: 0,
      LOCAL: 0
    };
    parser.oncue = segmentInfo.cues.push.bind(segmentInfo.cues);

    parser.ontimestampmap = map => {
      segmentInfo.timestampmap = map;
    };

    parser.onparsingerror = error => {
      videojs.log.warn('Error encountered when parsing cues: ' + error.message);
    };

    if (segmentInfo.segment.map) {
      let mapData = segmentInfo.segment.map.bytes;

      if (decodeBytesToString) {
        mapData = uint8ToUtf8(mapData);
      }

      parser.parse(mapData);
    }

    let segmentData = segmentInfo.bytes;

    if (decodeBytesToString) {
      segmentData = uint8ToUtf8(segmentData);
    }

    parser.parse(segmentData);
    parser.flush();
  }
  /**
   * Updates the start and end times of any cues parsed by the WebVTT parser using
   * the information parsed from the X-TIMESTAMP-MAP header and a TS to media time mapping
   * from the SyncController
   *
   * @param {Object} segmentInfo
   *        a segment info object that describes the current segment
   * @param {Object} mappingObj
   *        object containing a mapping from TS to media time
   * @param {Object} playlist
   *        the playlist object containing the segment
   * @private
   */


  updateTimeMapping_(segmentInfo, mappingObj, playlist) {
    const segment = segmentInfo.segment;

    if (!mappingObj) {
      // If the sync controller does not have a mapping of TS to Media Time for the
      // timeline, then we don't have enough information to update the cue
      // start/end times
      return;
    }

    if (!segmentInfo.cues.length) {
      // If there are no cues, we also do not have enough information to figure out
      // segment timing. Mark that the segment contains no cues so we don't re-request
      // an empty segment.
      segment.empty = true;
      return;
    }

    const timestampmap = segmentInfo.timestampmap;
    const diff = timestampmap.MPEGTS / ONE_SECOND_IN_TS - timestampmap.LOCAL + mappingObj.mapping;
    segmentInfo.cues.forEach(cue => {
      // First convert cue time to TS time using the timestamp-map provided within the vtt
      cue.startTime += diff;
      cue.endTime += diff;
    });

    if (!playlist.syncInfo) {
      const firstStart = segmentInfo.cues[0].startTime;
      const lastStart = segmentInfo.cues[segmentInfo.cues.length - 1].startTime;
      playlist.syncInfo = {
        mediaSequence: playlist.mediaSequence + segmentInfo.mediaIndex,
        time: Math.min(firstStart, lastStart - segment.duration)
      };
    }
  }

}

/**
 * @file ad-cue-tags.js
 */
/**
 * Searches for an ad cue that overlaps with the given mediaTime
 *
 * @param {Object} track
 *        the track to find the cue for
 *
 * @param {number} mediaTime
 *        the time to find the cue at
 *
 * @return {Object|null}
 *         the found cue or null
 */

const findAdCue = function (track, mediaTime) {
  const cues = track.cues;

  for (let i = 0; i < cues.length; i++) {
    const cue = cues[i];

    if (mediaTime >= cue.adStartTime && mediaTime <= cue.adEndTime) {
      return cue;
    }
  }

  return null;
};
const updateAdCues = function (media, track, offset = 0) {
  if (!media.segments) {
    return;
  }

  let mediaTime = offset;
  let cue;

  for (let i = 0; i < media.segments.length; i++) {
    const segment = media.segments[i];

    if (!cue) {
      // Since the cues will span for at least the segment duration, adding a fudge
      // factor of half segment duration will prevent duplicate cues from being
      // created when timing info is not exact (e.g. cue start time initialized
      // at 10.006677, but next call mediaTime is 10.003332 )
      cue = findAdCue(track, mediaTime + segment.duration / 2);
    }

    if (cue) {
      if ('cueIn' in segment) {
        // Found a CUE-IN so end the cue
        cue.endTime = mediaTime;
        cue.adEndTime = mediaTime;
        mediaTime += segment.duration;
        cue = null;
        continue;
      }

      if (mediaTime < cue.endTime) {
        // Already processed this mediaTime for this cue
        mediaTime += segment.duration;
        continue;
      } // otherwise extend cue until a CUE-IN is found


      cue.endTime += segment.duration;
    } else {
      if ('cueOut' in segment) {
        cue = new window$1.VTTCue(mediaTime, mediaTime + segment.duration, segment.cueOut);
        cue.adStartTime = mediaTime; // Assumes tag format to be
        // #EXT-X-CUE-OUT:30

        cue.adEndTime = mediaTime + parseFloat(segment.cueOut);
        track.addCue(cue);
      }

      if ('cueOutCont' in segment) {
        // Entered into the middle of an ad cue
        // Assumes tag formate to be
        // #EXT-X-CUE-OUT-CONT:10/30
        const [adOffset, adTotal] = segment.cueOutCont.split('/').map(parseFloat);
        cue = new window$1.VTTCue(mediaTime, mediaTime + segment.duration, '');
        cue.adStartTime = mediaTime - adOffset;
        cue.adEndTime = cue.adStartTime + adTotal;
        track.addCue(cue);
      }
    }

    mediaTime += segment.duration;
  }
};

/**
 * @file sync-controller.js
 */
// synchronize expired playlist segments.
// the max media sequence diff is 48 hours of live stream
// content with two second segments. Anything larger than that
// will likely be invalid.

const MAX_MEDIA_SEQUENCE_DIFF_FOR_SYNC = 86400;
const syncPointStrategies = [// Stategy "VOD": Handle the VOD-case where the sync-point is *always*
//                the equivalence display-time 0 === segment-index 0
{
  name: 'VOD',
  run: (syncController, playlist, duration, currentTimeline, currentTime) => {
    if (duration !== Infinity) {
      const syncPoint = {
        time: 0,
        segmentIndex: 0,
        partIndex: null
      };
      return syncPoint;
    }

    return null;
  }
}, {
  name: 'MediaSequence',

  /**
   * run media sequence strategy
   *
   * @param {SyncController} syncController
   * @param {Object} playlist
   * @param {number} duration
   * @param {number} currentTimeline
   * @param {number} currentTime
   * @param {string} type
   */
  run: (syncController, playlist, duration, currentTimeline, currentTime, type) => {
    if (!type) {
      return null;
    }

    const mediaSequenceMap = syncController.getMediaSequenceMap(type);

    if (!mediaSequenceMap || mediaSequenceMap.size === 0) {
      return null;
    }

    if (playlist.mediaSequence === undefined || !Array.isArray(playlist.segments) || !playlist.segments.length) {
      return null;
    }

    let currentMediaSequence = playlist.mediaSequence;
    let segmentIndex = 0;

    for (const segment of playlist.segments) {
      const range = mediaSequenceMap.get(currentMediaSequence);

      if (!range) {
        // unexpected case
        // we expect this playlist to be the same playlist in the map
        // just break from the loop and move forward to the next strategy
        break;
      }

      if (currentTime >= range.start && currentTime < range.end) {
        // we found segment
        if (Array.isArray(segment.parts) && segment.parts.length) {
          let currentPartStart = range.start;
          let partIndex = 0;

          for (const part of segment.parts) {
            const start = currentPartStart;
            const end = start + part.duration;

            if (currentTime >= start && currentTime < end) {
              return {
                time: range.start,
                segmentIndex,
                partIndex
              };
            }

            partIndex++;
            currentPartStart = end;
          }
        } // no parts found, return sync point for segment


        return {
          time: range.start,
          segmentIndex,
          partIndex: null
        };
      }

      segmentIndex++;
      currentMediaSequence++;
    } // we didn't find any segments for provided current time


    return null;
  }
}, // Stategy "ProgramDateTime": We have a program-date-time tag in this playlist
{
  name: 'ProgramDateTime',
  run: (syncController, playlist, duration, currentTimeline, currentTime) => {
    if (!Object.keys(syncController.timelineToDatetimeMappings).length) {
      return null;
    }

    let syncPoint = null;
    let lastDistance = null;
    const partsAndSegments = getPartsAndSegments(playlist);
    currentTime = currentTime || 0;

    for (let i = 0; i < partsAndSegments.length; i++) {
      // start from the end and loop backwards for live
      // or start from the front and loop forwards for non-live
      const index = playlist.endList || currentTime === 0 ? i : partsAndSegments.length - (i + 1);
      const partAndSegment = partsAndSegments[index];
      const segment = partAndSegment.segment;
      const datetimeMapping = syncController.timelineToDatetimeMappings[segment.timeline];

      if (!datetimeMapping || !segment.dateTimeObject) {
        continue;
      }

      const segmentTime = segment.dateTimeObject.getTime() / 1000;
      let start = segmentTime + datetimeMapping; // take part duration into account.

      if (segment.parts && typeof partAndSegment.partIndex === 'number') {
        for (let z = 0; z < partAndSegment.partIndex; z++) {
          start += segment.parts[z].duration;
        }
      }

      const distance = Math.abs(currentTime - start); // Once the distance begins to increase, or if distance is 0, we have passed
      // currentTime and can stop looking for better candidates

      if (lastDistance !== null && (distance === 0 || lastDistance < distance)) {
        break;
      }

      lastDistance = distance;
      syncPoint = {
        time: start,
        segmentIndex: partAndSegment.segmentIndex,
        partIndex: partAndSegment.partIndex
      };
    }

    return syncPoint;
  }
}, // Stategy "Segment": We have a known time mapping for a timeline and a
//                    segment in the current timeline with timing data
{
  name: 'Segment',
  run: (syncController, playlist, duration, currentTimeline, currentTime) => {
    let syncPoint = null;
    let lastDistance = null;
    currentTime = currentTime || 0;
    const partsAndSegments = getPartsAndSegments(playlist);

    for (let i = 0; i < partsAndSegments.length; i++) {
      // start from the end and loop backwards for live
      // or start from the front and loop forwards for non-live
      const index = playlist.endList || currentTime === 0 ? i : partsAndSegments.length - (i + 1);
      const partAndSegment = partsAndSegments[index];
      const segment = partAndSegment.segment;
      const start = partAndSegment.part && partAndSegment.part.start || segment && segment.start;

      if (segment.timeline === currentTimeline && typeof start !== 'undefined') {
        const distance = Math.abs(currentTime - start); // Once the distance begins to increase, we have passed
        // currentTime and can stop looking for better candidates

        if (lastDistance !== null && lastDistance < distance) {
          break;
        }

        if (!syncPoint || lastDistance === null || lastDistance >= distance) {
          lastDistance = distance;
          syncPoint = {
            time: start,
            segmentIndex: partAndSegment.segmentIndex,
            partIndex: partAndSegment.partIndex
          };
        }
      }
    }

    return syncPoint;
  }
}, // Stategy "Discontinuity": We have a discontinuity with a known
//                          display-time
{
  name: 'Discontinuity',
  run: (syncController, playlist, duration, currentTimeline, currentTime) => {
    let syncPoint = null;
    currentTime = currentTime || 0;

    if (playlist.discontinuityStarts && playlist.discontinuityStarts.length) {
      let lastDistance = null;

      for (let i = 0; i < playlist.discontinuityStarts.length; i++) {
        const segmentIndex = playlist.discontinuityStarts[i];
        const discontinuity = playlist.discontinuitySequence + i + 1;
        const discontinuitySync = syncController.discontinuities[discontinuity];

        if (discontinuitySync) {
          const distance = Math.abs(currentTime - discontinuitySync.time); // Once the distance begins to increase, we have passed
          // currentTime and can stop looking for better candidates

          if (lastDistance !== null && lastDistance < distance) {
            break;
          }

          if (!syncPoint || lastDistance === null || lastDistance >= distance) {
            lastDistance = distance;
            syncPoint = {
              time: discontinuitySync.time,
              segmentIndex,
              partIndex: null
            };
          }
        }
      }
    }

    return syncPoint;
  }
}, // Stategy "Playlist": We have a playlist with a known mapping of
//                     segment index to display time
{
  name: 'Playlist',
  run: (syncController, playlist, duration, currentTimeline, currentTime) => {
    if (playlist.syncInfo) {
      const syncPoint = {
        time: playlist.syncInfo.time,
        segmentIndex: playlist.syncInfo.mediaSequence - playlist.mediaSequence,
        partIndex: null
      };
      return syncPoint;
    }

    return null;
  }
}];
class SyncController extends videojs.EventTarget {
  constructor(options = {}) {
    super(); // ...for synching across variants

    this.timelines = [];
    this.discontinuities = [];
    this.timelineToDatetimeMappings = {};
    /**
     * @type {Map<string, Map<number, { start: number, end: number }>>}
     * @private
     */

    this.mediaSequenceStorage_ = new Map();
    this.logger_ = logger('SyncController');
  }
  /**
   * Get media sequence map by type
   *
   * @param {string} type - segment loader type
   * @return {Map<number, { start: number, end: number }> | undefined}
   */


  getMediaSequenceMap(type) {
    return this.mediaSequenceStorage_.get(type);
  }
  /**
   * Update Media Sequence Map -> <MediaSequence, Range>
   *
   * @param {Object} playlist - parsed playlist
   * @param {number} currentTime - current player's time
   * @param {string} type - segment loader type
   * @return {void}
   */


  updateMediaSequenceMap(playlist, currentTime, type) {
    // we should not process this playlist if it does not have mediaSequence or segments
    if (playlist.mediaSequence === undefined || !Array.isArray(playlist.segments) || !playlist.segments.length) {
      return;
    }

    const currentMap = this.getMediaSequenceMap(type);
    const result = new Map();
    let currentMediaSequence = playlist.mediaSequence;
    let currentBaseTime;

    if (!currentMap) {
      // first playlist setup:
      currentBaseTime = 0;
    } else if (currentMap.has(playlist.mediaSequence)) {
      // further playlists setup:
      currentBaseTime = currentMap.get(playlist.mediaSequence).start;
    } else {
      // it seems like we have a gap between playlists, use current time as a fallback:
      this.logger_(`MediaSequence sync for ${type} segment loader - received a gap between playlists.
Fallback base time to: ${currentTime}.
Received media sequence: ${currentMediaSequence}.
Current map: `, currentMap);
      currentBaseTime = currentTime;
    }

    this.logger_(`MediaSequence sync for ${type} segment loader.
Received media sequence: ${currentMediaSequence}.
base time is ${currentBaseTime}
Current map: `, currentMap);
    playlist.segments.forEach(segment => {
      const start = currentBaseTime;
      const end = start + segment.duration;
      const range = {
        start,
        end
      };
      result.set(currentMediaSequence, range);
      currentMediaSequence++;
      currentBaseTime = end;
    });
    this.mediaSequenceStorage_.set(type, result);
  }
  /**
   * Find a sync-point for the playlist specified
   *
   * A sync-point is defined as a known mapping from display-time to
   * a segment-index in the current playlist.
   *
   * @param {Playlist} playlist
   *        The playlist that needs a sync-point
   * @param {number} duration
   *        Duration of the MediaSource (Infinite if playing a live source)
   * @param {number} currentTimeline
   *        The last timeline from which a segment was loaded
   * @param {number} currentTime
   *        Current player's time
   * @param {string} type
   *        Segment loader type
   * @return {Object}
   *          A sync-point object
   */


  getSyncPoint(playlist, duration, currentTimeline, currentTime, type) {
    // Always use VOD sync point for VOD
    if (duration !== Infinity) {
      const vodSyncPointStrategy = syncPointStrategies.find(({
        name
      }) => name === 'VOD');
      return vodSyncPointStrategy.run(this, playlist, duration);
    }

    const syncPoints = this.runStrategies_(playlist, duration, currentTimeline, currentTime, type);

    if (!syncPoints.length) {
      // Signal that we need to attempt to get a sync-point manually
      // by fetching a segment in the playlist and constructing
      // a sync-point from that information
      return null;
    } // If we have exact match just return it instead of finding the nearest distance


    for (const syncPointInfo of syncPoints) {
      const {
        syncPoint,
        strategy
      } = syncPointInfo;
      const {
        segmentIndex,
        time
      } = syncPoint;

      if (segmentIndex < 0) {
        continue;
      }

      const selectedSegment = playlist.segments[segmentIndex];
      const start = time;
      const end = start + selectedSegment.duration;
      this.logger_(`Strategy: ${strategy}. Current time: ${currentTime}. selected segment: ${segmentIndex}. Time: [${start} -> ${end}]}`);

      if (currentTime >= start && currentTime < end) {
        this.logger_('Found sync point with exact match: ', syncPoint);
        return syncPoint;
      }
    } // Now find the sync-point that is closest to the currentTime because
    // that should result in the most accurate guess about which segment
    // to fetch


    return this.selectSyncPoint_(syncPoints, {
      key: 'time',
      value: currentTime
    });
  }
  /**
   * Calculate the amount of time that has expired off the playlist during playback
   *
   * @param {Playlist} playlist
   *        Playlist object to calculate expired from
   * @param {number} duration
   *        Duration of the MediaSource (Infinity if playling a live source)
   * @return {number|null}
   *          The amount of time that has expired off the playlist during playback. Null
   *          if no sync-points for the playlist can be found.
   */


  getExpiredTime(playlist, duration) {
    if (!playlist || !playlist.segments) {
      return null;
    }

    const syncPoints = this.runStrategies_(playlist, duration, playlist.discontinuitySequence, 0, 'main'); // Without sync-points, there is not enough information to determine the expired time

    if (!syncPoints.length) {
      return null;
    }

    const syncPoint = this.selectSyncPoint_(syncPoints, {
      key: 'segmentIndex',
      value: 0
    }); // If the sync-point is beyond the start of the playlist, we want to subtract the
    // duration from index 0 to syncPoint.segmentIndex instead of adding.

    if (syncPoint.segmentIndex > 0) {
      syncPoint.time *= -1;
    }

    return Math.abs(syncPoint.time + sumDurations({
      defaultDuration: playlist.targetDuration,
      durationList: playlist.segments,
      startIndex: syncPoint.segmentIndex,
      endIndex: 0
    }));
  }
  /**
   * Runs each sync-point strategy and returns a list of sync-points returned by the
   * strategies
   *
   * @private
   * @param {Playlist} playlist
   *        The playlist that needs a sync-point
   * @param {number} duration
   *        Duration of the MediaSource (Infinity if playing a live source)
   * @param {number} currentTimeline
   *        The last timeline from which a segment was loaded
   * @param {number} currentTime
   *        Current player's time
   * @param {string} type
   *        Segment loader type
   * @return {Array}
   *          A list of sync-point objects
   */


  runStrategies_(playlist, duration, currentTimeline, currentTime, type) {
    const syncPoints = []; // Try to find a sync-point in by utilizing various strategies...

    for (let i = 0; i < syncPointStrategies.length; i++) {
      const strategy = syncPointStrategies[i];
      const syncPoint = strategy.run(this, playlist, duration, currentTimeline, currentTime, type);

      if (syncPoint) {
        syncPoint.strategy = strategy.name;
        syncPoints.push({
          strategy: strategy.name,
          syncPoint
        });
      }
    }

    return syncPoints;
  }
  /**
   * Selects the sync-point nearest the specified target
   *
   * @private
   * @param {Array} syncPoints
   *        List of sync-points to select from
   * @param {Object} target
   *        Object specifying the property and value we are targeting
   * @param {string} target.key
   *        Specifies the property to target. Must be either 'time' or 'segmentIndex'
   * @param {number} target.value
   *        The value to target for the specified key.
   * @return {Object}
   *          The sync-point nearest the target
   */


  selectSyncPoint_(syncPoints, target) {
    let bestSyncPoint = syncPoints[0].syncPoint;
    let bestDistance = Math.abs(syncPoints[0].syncPoint[target.key] - target.value);
    let bestStrategy = syncPoints[0].strategy;

    for (let i = 1; i < syncPoints.length; i++) {
      const newDistance = Math.abs(syncPoints[i].syncPoint[target.key] - target.value);

      if (newDistance < bestDistance) {
        bestDistance = newDistance;
        bestSyncPoint = syncPoints[i].syncPoint;
        bestStrategy = syncPoints[i].strategy;
      }
    }

    this.logger_(`syncPoint for [${target.key}: ${target.value}] chosen with strategy` + ` [${bestStrategy}]: [time:${bestSyncPoint.time},` + ` segmentIndex:${bestSyncPoint.segmentIndex}` + (typeof bestSyncPoint.partIndex === 'number' ? `,partIndex:${bestSyncPoint.partIndex}` : '') + ']');
    return bestSyncPoint;
  }
  /**
   * Save any meta-data present on the segments when segments leave
   * the live window to the playlist to allow for synchronization at the
   * playlist level later.
   *
   * @param {Playlist} oldPlaylist - The previous active playlist
   * @param {Playlist} newPlaylist - The updated and most current playlist
   */


  saveExpiredSegmentInfo(oldPlaylist, newPlaylist) {
    const mediaSequenceDiff = newPlaylist.mediaSequence - oldPlaylist.mediaSequence; // Ignore large media sequence gaps

    if (mediaSequenceDiff > MAX_MEDIA_SEQUENCE_DIFF_FOR_SYNC) {
      videojs.log.warn(`Not saving expired segment info. Media sequence gap ${mediaSequenceDiff} is too large.`);
      return;
    } // When a segment expires from the playlist and it has a start time
    // save that information as a possible sync-point reference in future


    for (let i = mediaSequenceDiff - 1; i >= 0; i--) {
      const lastRemovedSegment = oldPlaylist.segments[i];

      if (lastRemovedSegment && typeof lastRemovedSegment.start !== 'undefined') {
        newPlaylist.syncInfo = {
          mediaSequence: oldPlaylist.mediaSequence + i,
          time: lastRemovedSegment.start
        };
        this.logger_(`playlist refresh sync: [time:${newPlaylist.syncInfo.time},` + ` mediaSequence: ${newPlaylist.syncInfo.mediaSequence}]`);
        this.trigger('syncinfoupdate');
        break;
      }
    }
  }
  /**
   * Save the mapping from playlist's ProgramDateTime to display. This should only happen
   * before segments start to load.
   *
   * @param {Playlist} playlist - The currently active playlist
   */


  setDateTimeMappingForStart(playlist) {
    // It's possible for the playlist to be updated before playback starts, meaning time
    // zero is not yet set. If, during these playlist refreshes, a discontinuity is
    // crossed, then the old time zero mapping (for the prior timeline) would be retained
    // unless the mappings are cleared.
    this.timelineToDatetimeMappings = {};

    if (playlist.segments && playlist.segments.length && playlist.segments[0].dateTimeObject) {
      const firstSegment = playlist.segments[0];
      const playlistTimestamp = firstSegment.dateTimeObject.getTime() / 1000;
      this.timelineToDatetimeMappings[firstSegment.timeline] = -playlistTimestamp;
    }
  }
  /**
   * Calculates and saves timeline mappings, playlist sync info, and segment timing values
   * based on the latest timing information.
   *
   * @param {Object} options
   *        Options object
   * @param {SegmentInfo} options.segmentInfo
   *        The current active request information
   * @param {boolean} options.shouldSaveTimelineMapping
   *        If there's a timeline change, determines if the timeline mapping should be
   *        saved for timeline mapping and program date time mappings.
   */


  saveSegmentTimingInfo({
    segmentInfo,
    shouldSaveTimelineMapping
  }) {
    const didCalculateSegmentTimeMapping = this.calculateSegmentTimeMapping_(segmentInfo, segmentInfo.timingInfo, shouldSaveTimelineMapping);
    const segment = segmentInfo.segment;

    if (didCalculateSegmentTimeMapping) {
      this.saveDiscontinuitySyncInfo_(segmentInfo); // If the playlist does not have sync information yet, record that information
      // now with segment timing information

      if (!segmentInfo.playlist.syncInfo) {
        segmentInfo.playlist.syncInfo = {
          mediaSequence: segmentInfo.playlist.mediaSequence + segmentInfo.mediaIndex,
          time: segment.start
        };
      }
    }

    const dateTime = segment.dateTimeObject;

    if (segment.discontinuity && shouldSaveTimelineMapping && dateTime) {
      this.timelineToDatetimeMappings[segment.timeline] = -(dateTime.getTime() / 1000);
    }
  }

  timestampOffsetForTimeline(timeline) {
    if (typeof this.timelines[timeline] === 'undefined') {
      return null;
    }

    return this.timelines[timeline].time;
  }

  mappingForTimeline(timeline) {
    if (typeof this.timelines[timeline] === 'undefined') {
      return null;
    }

    return this.timelines[timeline].mapping;
  }
  /**
   * Use the "media time" for a segment to generate a mapping to "display time" and
   * save that display time to the segment.
   *
   * @private
   * @param {SegmentInfo} segmentInfo
   *        The current active request information
   * @param {Object} timingInfo
   *        The start and end time of the current segment in "media time"
   * @param {boolean} shouldSaveTimelineMapping
   *        If there's a timeline change, determines if the timeline mapping should be
   *        saved in timelines.
   * @return {boolean}
   *          Returns false if segment time mapping could not be calculated
   */


  calculateSegmentTimeMapping_(segmentInfo, timingInfo, shouldSaveTimelineMapping) {
    // TODO: remove side effects
    const segment = segmentInfo.segment;
    const part = segmentInfo.part;
    let mappingObj = this.timelines[segmentInfo.timeline];
    let start;
    let end;

    if (typeof segmentInfo.timestampOffset === 'number') {
      mappingObj = {
        time: segmentInfo.startOfSegment,
        mapping: segmentInfo.startOfSegment - timingInfo.start
      };

      if (shouldSaveTimelineMapping) {
        this.timelines[segmentInfo.timeline] = mappingObj;
        this.trigger('timestampoffset');
        this.logger_(`time mapping for timeline ${segmentInfo.timeline}: ` + `[time: ${mappingObj.time}] [mapping: ${mappingObj.mapping}]`);
      }

      start = segmentInfo.startOfSegment;
      end = timingInfo.end + mappingObj.mapping;
    } else if (mappingObj) {
      start = timingInfo.start + mappingObj.mapping;
      end = timingInfo.end + mappingObj.mapping;
    } else {
      return false;
    }

    if (part) {
      part.start = start;
      part.end = end;
    } // If we don't have a segment start yet or the start value we got
    // is less than our current segment.start value, save a new start value.
    // We have to do this because parts will have segment timing info saved
    // multiple times and we want segment start to be the earliest part start
    // value for that segment.


    if (!segment.start || start < segment.start) {
      segment.start = start;
    }

    segment.end = end;
    return true;
  }
  /**
   * Each time we have discontinuity in the playlist, attempt to calculate the location
   * in display of the start of the discontinuity and save that. We also save an accuracy
   * value so that we save values with the most accuracy (closest to 0.)
   *
   * @private
   * @param {SegmentInfo} segmentInfo - The current active request information
   */


  saveDiscontinuitySyncInfo_(segmentInfo) {
    const playlist = segmentInfo.playlist;
    const segment = segmentInfo.segment; // If the current segment is a discontinuity then we know exactly where
    // the start of the range and it's accuracy is 0 (greater accuracy values
    // mean more approximation)

    if (segment.discontinuity) {
      this.discontinuities[segment.timeline] = {
        time: segment.start,
        accuracy: 0
      };
    } else if (playlist.discontinuityStarts && playlist.discontinuityStarts.length) {
      // Search for future discontinuities that we can provide better timing
      // information for and save that information for sync purposes
      for (let i = 0; i < playlist.discontinuityStarts.length; i++) {
        const segmentIndex = playlist.discontinuityStarts[i];
        const discontinuity = playlist.discontinuitySequence + i + 1;
        const mediaIndexDiff = segmentIndex - segmentInfo.mediaIndex;
        const accuracy = Math.abs(mediaIndexDiff);

        if (!this.discontinuities[discontinuity] || this.discontinuities[discontinuity].accuracy > accuracy) {
          let time;

          if (mediaIndexDiff < 0) {
            time = segment.start - sumDurations({
              defaultDuration: playlist.targetDuration,
              durationList: playlist.segments,
              startIndex: segmentInfo.mediaIndex,
              endIndex: segmentIndex
            });
          } else {
            time = segment.end + sumDurations({
              defaultDuration: playlist.targetDuration,
              durationList: playlist.segments,
              startIndex: segmentInfo.mediaIndex + 1,
              endIndex: segmentIndex
            });
          }

          this.discontinuities[discontinuity] = {
            time,
            accuracy
          };
        }
      }
    }
  }

  dispose() {
    this.trigger('dispose');
    this.off();
  }

}

/**
 * The TimelineChangeController acts as a source for segment loaders to listen for and
 * keep track of latest and pending timeline changes. This is useful to ensure proper
 * sync, as each loader may need to make a consideration for what timeline the other
 * loader is on before making changes which could impact the other loader's media.
 *
 * @class TimelineChangeController
 * @extends videojs.EventTarget
 */

class TimelineChangeController extends videojs.EventTarget {
  constructor() {
    super();
    this.pendingTimelineChanges_ = {};
    this.lastTimelineChanges_ = {};
  }

  clearPendingTimelineChange(type) {
    this.pendingTimelineChanges_[type] = null;
    this.trigger('pendingtimelinechange');
  }

  pendingTimelineChange({
    type,
    from,
    to
  }) {
    if (typeof from === 'number' && typeof to === 'number') {
      this.pendingTimelineChanges_[type] = {
        type,
        from,
        to
      };
      this.trigger('pendingtimelinechange');
    }

    return this.pendingTimelineChanges_[type];
  }

  lastTimelineChange({
    type,
    from,
    to
  }) {
    if (typeof from === 'number' && typeof to === 'number') {
      this.lastTimelineChanges_[type] = {
        type,
        from,
        to
      };
      delete this.pendingTimelineChanges_[type];
      this.trigger('timelinechange');
    }

    return this.lastTimelineChanges_[type];
  }

  dispose() {
    this.trigger('dispose');
    this.pendingTimelineChanges_ = {};
    this.lastTimelineChanges_ = {};
    this.off();
  }

}

/* rollup-plugin-worker-factory start for worker!/home/runner/work/http-streaming/http-streaming/src/decrypter-worker.js */
const workerCode = transform(getWorkerString(function () {
  /**
   * @file stream.js
   */

  /**
   * A lightweight readable stream implemention that handles event dispatching.
   *
   * @class Stream
   */

  var Stream = /*#__PURE__*/function () {
    function Stream() {
      this.listeners = {};
    }
    /**
     * Add a listener for a specified event type.
     *
     * @param {string} type the event name
     * @param {Function} listener the callback to be invoked when an event of
     * the specified type occurs
     */


    var _proto = Stream.prototype;

    _proto.on = function on(type, listener) {
      if (!this.listeners[type]) {
        this.listeners[type] = [];
      }

      this.listeners[type].push(listener);
    }
    /**
     * Remove a listener for a specified event type.
     *
     * @param {string} type the event name
     * @param {Function} listener  a function previously registered for this
     * type of event through `on`
     * @return {boolean} if we could turn it off or not
     */
    ;

    _proto.off = function off(type, listener) {
      if (!this.listeners[type]) {
        return false;
      }

      var index = this.listeners[type].indexOf(listener); // TODO: which is better?
      // In Video.js we slice listener functions
      // on trigger so that it does not mess up the order
      // while we loop through.
      //
      // Here we slice on off so that the loop in trigger
      // can continue using it's old reference to loop without
      // messing up the order.

      this.listeners[type] = this.listeners[type].slice(0);
      this.listeners[type].splice(index, 1);
      return index > -1;
    }
    /**
     * Trigger an event of the specified type on this stream. Any additional
     * arguments to this function are passed as parameters to event listeners.
     *
     * @param {string} type the event name
     */
    ;

    _proto.trigger = function trigger(type) {
      var callbacks = this.listeners[type];

      if (!callbacks) {
        return;
      } // Slicing the arguments on every invocation of this method
      // can add a significant amount of overhead. Avoid the
      // intermediate object creation for the common case of a
      // single callback argument


      if (arguments.length === 2) {
        var length = callbacks.length;

        for (var i = 0; i < length; ++i) {
          callbacks[i].call(this, arguments[1]);
        }
      } else {
        var args = Array.prototype.slice.call(arguments, 1);
        var _length = callbacks.length;

        for (var _i = 0; _i < _length; ++_i) {
          callbacks[_i].apply(this, args);
        }
      }
    }
    /**
     * Destroys the stream and cleans up.
     */
    ;

    _proto.dispose = function dispose() {
      this.listeners = {};
    }
    /**
     * Forwards all `data` events on this stream to the destination stream. The
     * destination stream should provide a method `push` to receive the data
     * events as they arrive.
     *
     * @param {Stream} destination the stream that will receive all `data` events
     * @see http://nodejs.org/api/stream.html#stream_readable_pipe_destination_options
     */
    ;

    _proto.pipe = function pipe(destination) {
      this.on('data', function (data) {
        destination.push(data);
      });
    };

    return Stream;
  }();
  /*! @name pkcs7 @version 1.0.4 @license Apache-2.0 */

  /**
   * Returns the subarray of a Uint8Array without PKCS#7 padding.
   *
   * @param padded {Uint8Array} unencrypted bytes that have been padded
   * @return {Uint8Array} the unpadded bytes
   * @see http://tools.ietf.org/html/rfc5652
   */


  function unpad(padded) {
    return padded.subarray(0, padded.byteLength - padded[padded.byteLength - 1]);
  }
  /*! @name aes-decrypter @version 4.0.1 @license Apache-2.0 */

  /**
   * @file aes.js
   *
   * This file contains an adaptation of the AES decryption algorithm
   * from the Standford Javascript Cryptography Library. That work is
   * covered by the following copyright and permissions notice:
   *
   * Copyright 2009-2010 Emily Stark, Mike Hamburg, Dan Boneh.
   * All rights reserved.
   *
   * Redistribution and use in source and binary forms, with or without
   * modification, are permitted provided that the following conditions are
   * met:
   *
   * 1. Redistributions of source code must retain the above copyright
   *    notice, this list of conditions and the following disclaimer.
   *
   * 2. Redistributions in binary form must reproduce the above
   *    copyright notice, this list of conditions and the following
   *    disclaimer in the documentation and/or other materials provided
   *    with the distribution.
   *
   * THIS SOFTWARE IS PROVIDED BY THE AUTHORS ``AS IS'' AND ANY EXPRESS OR
   * IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
   * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
   * DISCLAIMED. IN NO EVENT SHALL <COPYRIGHT HOLDER> OR CONTRIBUTORS BE
   * LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
   * CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
   * SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR
   * BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY,
   * WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE
   * OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN
   * IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
   *
   * The views and conclusions contained in the software and documentation
   * are those of the authors and should not be interpreted as representing
   * official policies, either expressed or implied, of the authors.
   */

  /**
   * Expand the S-box tables.
   *
   * @private
   */


  const precompute = function () {
    const tables = [[[], [], [], [], []], [[], [], [], [], []]];
    const encTable = tables[0];
    const decTable = tables[1];
    const sbox = encTable[4];
    const sboxInv = decTable[4];
    let i;
    let x;
    let xInv;
    const d = [];
    const th = [];
    let x2;
    let x4;
    let x8;
    let s;
    let tEnc;
    let tDec; // Compute double and third tables

    for (i = 0; i < 256; i++) {
      th[(d[i] = i << 1 ^ (i >> 7) * 283) ^ i] = i;
    }

    for (x = xInv = 0; !sbox[x]; x ^= x2 || 1, xInv = th[xInv] || 1) {
      // Compute sbox
      s = xInv ^ xInv << 1 ^ xInv << 2 ^ xInv << 3 ^ xInv << 4;
      s = s >> 8 ^ s & 255 ^ 99;
      sbox[x] = s;
      sboxInv[s] = x; // Compute MixColumns

      x8 = d[x4 = d[x2 = d[x]]];
      tDec = x8 * 0x1010101 ^ x4 * 0x10001 ^ x2 * 0x101 ^ x * 0x1010100;
      tEnc = d[s] * 0x101 ^ s * 0x1010100;

      for (i = 0; i < 4; i++) {
        encTable[i][x] = tEnc = tEnc << 24 ^ tEnc >>> 8;
        decTable[i][s] = tDec = tDec << 24 ^ tDec >>> 8;
      }
    } // Compactify. Considerable speedup on Firefox.


    for (i = 0; i < 5; i++) {
      encTable[i] = encTable[i].slice(0);
      decTable[i] = decTable[i].slice(0);
    }

    return tables;
  };

  let aesTables = null;
  /**
   * Schedule out an AES key for both encryption and decryption. This
   * is a low-level class. Use a cipher mode to do bulk encryption.
   *
   * @class AES
   * @param key {Array} The key as an array of 4, 6 or 8 words.
   */

  class AES {
    constructor(key) {
      /**
      * The expanded S-box and inverse S-box tables. These will be computed
      * on the client so that we don't have to send them down the wire.
      *
      * There are two tables, _tables[0] is for encryption and
      * _tables[1] is for decryption.
      *
      * The first 4 sub-tables are the expanded S-box with MixColumns. The
      * last (_tables[01][4]) is the S-box itself.
      *
      * @private
      */
      // if we have yet to precompute the S-box tables
      // do so now
      if (!aesTables) {
        aesTables = precompute();
      } // then make a copy of that object for use


      this._tables = [[aesTables[0][0].slice(), aesTables[0][1].slice(), aesTables[0][2].slice(), aesTables[0][3].slice(), aesTables[0][4].slice()], [aesTables[1][0].slice(), aesTables[1][1].slice(), aesTables[1][2].slice(), aesTables[1][3].slice(), aesTables[1][4].slice()]];
      let i;
      let j;
      let tmp;
      const sbox = this._tables[0][4];
      const decTable = this._tables[1];
      const keyLen = key.length;
      let rcon = 1;

      if (keyLen !== 4 && keyLen !== 6 && keyLen !== 8) {
        throw new Error('Invalid aes key size');
      }

      const encKey = key.slice(0);
      const decKey = [];
      this._key = [encKey, decKey]; // schedule encryption keys

      for (i = keyLen; i < 4 * keyLen + 28; i++) {
        tmp = encKey[i - 1]; // apply sbox

        if (i % keyLen === 0 || keyLen === 8 && i % keyLen === 4) {
          tmp = sbox[tmp >>> 24] << 24 ^ sbox[tmp >> 16 & 255] << 16 ^ sbox[tmp >> 8 & 255] << 8 ^ sbox[tmp & 255]; // shift rows and add rcon

          if (i % keyLen === 0) {
            tmp = tmp << 8 ^ tmp >>> 24 ^ rcon << 24;
            rcon = rcon << 1 ^ (rcon >> 7) * 283;
          }
        }

        encKey[i] = encKey[i - keyLen] ^ tmp;
      } // schedule decryption keys


      for (j = 0; i; j++, i--) {
        tmp = encKey[j & 3 ? i : i - 4];

        if (i <= 4 || j < 4) {
          decKey[j] = tmp;
        } else {
          decKey[j] = decTable[0][sbox[tmp >>> 24]] ^ decTable[1][sbox[tmp >> 16 & 255]] ^ decTable[2][sbox[tmp >> 8 & 255]] ^ decTable[3][sbox[tmp & 255]];
        }
      }
    }
    /**
     * Decrypt 16 bytes, specified as four 32-bit words.
     *
     * @param {number} encrypted0 the first word to decrypt
     * @param {number} encrypted1 the second word to decrypt
     * @param {number} encrypted2 the third word to decrypt
     * @param {number} encrypted3 the fourth word to decrypt
     * @param {Int32Array} out the array to write the decrypted words
     * into
     * @param {number} offset the offset into the output array to start
     * writing results
     * @return {Array} The plaintext.
     */


    decrypt(encrypted0, encrypted1, encrypted2, encrypted3, out, offset) {
      const key = this._key[1]; // state variables a,b,c,d are loaded with pre-whitened data

      let a = encrypted0 ^ key[0];
      let b = encrypted3 ^ key[1];
      let c = encrypted2 ^ key[2];
      let d = encrypted1 ^ key[3];
      let a2;
      let b2;
      let c2; // key.length === 2 ?

      const nInnerRounds = key.length / 4 - 2;
      let i;
      let kIndex = 4;
      const table = this._tables[1]; // load up the tables

      const table0 = table[0];
      const table1 = table[1];
      const table2 = table[2];
      const table3 = table[3];
      const sbox = table[4]; // Inner rounds. Cribbed from OpenSSL.

      for (i = 0; i < nInnerRounds; i++) {
        a2 = table0[a >>> 24] ^ table1[b >> 16 & 255] ^ table2[c >> 8 & 255] ^ table3[d & 255] ^ key[kIndex];
        b2 = table0[b >>> 24] ^ table1[c >> 16 & 255] ^ table2[d >> 8 & 255] ^ table3[a & 255] ^ key[kIndex + 1];
        c2 = table0[c >>> 24] ^ table1[d >> 16 & 255] ^ table2[a >> 8 & 255] ^ table3[b & 255] ^ key[kIndex + 2];
        d = table0[d >>> 24] ^ table1[a >> 16 & 255] ^ table2[b >> 8 & 255] ^ table3[c & 255] ^ key[kIndex + 3];
        kIndex += 4;
        a = a2;
        b = b2;
        c = c2;
      } // Last round.


      for (i = 0; i < 4; i++) {
        out[(3 & -i) + offset] = sbox[a >>> 24] << 24 ^ sbox[b >> 16 & 255] << 16 ^ sbox[c >> 8 & 255] << 8 ^ sbox[d & 255] ^ key[kIndex++];
        a2 = a;
        a = b;
        b = c;
        c = d;
        d = a2;
      }
    }

  }
  /**
   * @file async-stream.js
   */

  /**
   * A wrapper around the Stream class to use setTimeout
   * and run stream "jobs" Asynchronously
   *
   * @class AsyncStream
   * @extends Stream
   */


  class AsyncStream extends Stream {
    constructor() {
      super(Stream);
      this.jobs = [];
      this.delay = 1;
      this.timeout_ = null;
    }
    /**
     * process an async job
     *
     * @private
     */


    processJob_() {
      this.jobs.shift()();

      if (this.jobs.length) {
        this.timeout_ = setTimeout(this.processJob_.bind(this), this.delay);
      } else {
        this.timeout_ = null;
      }
    }
    /**
     * push a job into the stream
     *
     * @param {Function} job the job to push into the stream
     */


    push(job) {
      this.jobs.push(job);

      if (!this.timeout_) {
        this.timeout_ = setTimeout(this.processJob_.bind(this), this.delay);
      }
    }

  }
  /**
   * @file decrypter.js
   *
   * An asynchronous implementation of AES-128 CBC decryption with
   * PKCS#7 padding.
   */

  /**
   * Convert network-order (big-endian) bytes into their little-endian
   * representation.
   */


  const ntoh = function (word) {
    return word << 24 | (word & 0xff00) << 8 | (word & 0xff0000) >> 8 | word >>> 24;
  };
  /**
   * Decrypt bytes using AES-128 with CBC and PKCS#7 padding.
   *
   * @param {Uint8Array} encrypted the encrypted bytes
   * @param {Uint32Array} key the bytes of the decryption key
   * @param {Uint32Array} initVector the initialization vector (IV) to
   * use for the first round of CBC.
   * @return {Uint8Array} the decrypted bytes
   *
   * @see http://en.wikipedia.org/wiki/Advanced_Encryption_Standard
   * @see http://en.wikipedia.org/wiki/Block_cipher_mode_of_operation#Cipher_Block_Chaining_.28CBC.29
   * @see https://tools.ietf.org/html/rfc2315
   */


  const decrypt = function (encrypted, key, initVector) {
    // word-level access to the encrypted bytes
    const encrypted32 = new Int32Array(encrypted.buffer, encrypted.byteOffset, encrypted.byteLength >> 2);
    const decipher = new AES(Array.prototype.slice.call(key)); // byte and word-level access for the decrypted output

    const decrypted = new Uint8Array(encrypted.byteLength);
    const decrypted32 = new Int32Array(decrypted.buffer); // temporary variables for working with the IV, encrypted, and
    // decrypted data

    let init0;
    let init1;
    let init2;
    let init3;
    let encrypted0;
    let encrypted1;
    let encrypted2;
    let encrypted3; // iteration variable

    let wordIx; // pull out the words of the IV to ensure we don't modify the
    // passed-in reference and easier access

    init0 = initVector[0];
    init1 = initVector[1];
    init2 = initVector[2];
    init3 = initVector[3]; // decrypt four word sequences, applying cipher-block chaining (CBC)
    // to each decrypted block

    for (wordIx = 0; wordIx < encrypted32.length; wordIx += 4) {
      // convert big-endian (network order) words into little-endian
      // (javascript order)
      encrypted0 = ntoh(encrypted32[wordIx]);
      encrypted1 = ntoh(encrypted32[wordIx + 1]);
      encrypted2 = ntoh(encrypted32[wordIx + 2]);
      encrypted3 = ntoh(encrypted32[wordIx + 3]); // decrypt the block

      decipher.decrypt(encrypted0, encrypted1, encrypted2, encrypted3, decrypted32, wordIx); // XOR with the IV, and restore network byte-order to obtain the
      // plaintext

      decrypted32[wordIx] = ntoh(decrypted32[wordIx] ^ init0);
      decrypted32[wordIx + 1] = ntoh(decrypted32[wordIx + 1] ^ init1);
      decrypted32[wordIx + 2] = ntoh(decrypted32[wordIx + 2] ^ init2);
      decrypted32[wordIx + 3] = ntoh(decrypted32[wordIx + 3] ^ init3); // setup the IV for the next round

      init0 = encrypted0;
      init1 = encrypted1;
      init2 = encrypted2;
      init3 = encrypted3;
    }

    return decrypted;
  };
  /**
   * The `Decrypter` class that manages decryption of AES
   * data through `AsyncStream` objects and the `decrypt`
   * function
   *
   * @param {Uint8Array} encrypted the encrypted bytes
   * @param {Uint32Array} key the bytes of the decryption key
   * @param {Uint32Array} initVector the initialization vector (IV) to
   * @param {Function} done the function to run when done
   * @class Decrypter
   */


  class Decrypter {
    constructor(encrypted, key, initVector, done) {
      const step = Decrypter.STEP;
      const encrypted32 = new Int32Array(encrypted.buffer);
      const decrypted = new Uint8Array(encrypted.byteLength);
      let i = 0;
      this.asyncStream_ = new AsyncStream(); // split up the encryption job and do the individual chunks asynchronously

      this.asyncStream_.push(this.decryptChunk_(encrypted32.subarray(i, i + step), key, initVector, decrypted));

      for (i = step; i < encrypted32.length; i += step) {
        initVector = new Uint32Array([ntoh(encrypted32[i - 4]), ntoh(encrypted32[i - 3]), ntoh(encrypted32[i - 2]), ntoh(encrypted32[i - 1])]);
        this.asyncStream_.push(this.decryptChunk_(encrypted32.subarray(i, i + step), key, initVector, decrypted));
      } // invoke the done() callback when everything is finished


      this.asyncStream_.push(function () {
        // remove pkcs#7 padding from the decrypted bytes
        done(null, unpad(decrypted));
      });
    }
    /**
     * a getter for step the maximum number of bytes to process at one time
     *
     * @return {number} the value of step 32000
     */


    static get STEP() {
      // 4 * 8000;
      return 32000;
    }
    /**
     * @private
     */


    decryptChunk_(encrypted, key, initVector, decrypted) {
      return function () {
        const bytes = decrypt(encrypted, key, initVector);
        decrypted.set(bytes, encrypted.byteOffset);
      };
    }

  }

  var commonjsGlobal = typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : {};
  var win;

  if (typeof window !== "undefined") {
    win = window;
  } else if (typeof commonjsGlobal !== "undefined") {
    win = commonjsGlobal;
  } else if (typeof self !== "undefined") {
    win = self;
  } else {
    win = {};
  }

  var window_1 = win;

  var isArrayBufferView = function isArrayBufferView(obj) {
    if (ArrayBuffer.isView === 'function') {
      return ArrayBuffer.isView(obj);
    }

    return obj && obj.buffer instanceof ArrayBuffer;
  };

  var BigInt = window_1.BigInt || Number;
  [BigInt('0x1'), BigInt('0x100'), BigInt('0x10000'), BigInt('0x1000000'), BigInt('0x100000000'), BigInt('0x10000000000'), BigInt('0x1000000000000'), BigInt('0x100000000000000'), BigInt('0x10000000000000000')];

  (function () {
    var a = new Uint16Array([0xFFCC]);
    var b = new Uint8Array(a.buffer, a.byteOffset, a.byteLength);

    if (b[0] === 0xFF) {
      return 'big';
    }

    if (b[0] === 0xCC) {
      return 'little';
    }

    return 'unknown';
  })();
  /**
   * Creates an object for sending to a web worker modifying properties that are TypedArrays
   * into a new object with seperated properties for the buffer, byteOffset, and byteLength.
   *
   * @param {Object} message
   *        Object of properties and values to send to the web worker
   * @return {Object}
   *         Modified message with TypedArray values expanded
   * @function createTransferableMessage
   */


  const createTransferableMessage = function (message) {
    const transferable = {};
    Object.keys(message).forEach(key => {
      const value = message[key];

      if (isArrayBufferView(value)) {
        transferable[key] = {
          bytes: value.buffer,
          byteOffset: value.byteOffset,
          byteLength: value.byteLength
        };
      } else {
        transferable[key] = value;
      }
    });
    return transferable;
  };
  /* global self */

  /**
   * Our web worker interface so that things can talk to aes-decrypter
   * that will be running in a web worker. the scope is passed to this by
   * webworkify.
   */


  self.onmessage = function (event) {
    const data = event.data;
    const encrypted = new Uint8Array(data.encrypted.bytes, data.encrypted.byteOffset, data.encrypted.byteLength);
    const key = new Uint32Array(data.key.bytes, data.key.byteOffset, data.key.byteLength / 4);
    const iv = new Uint32Array(data.iv.bytes, data.iv.byteOffset, data.iv.byteLength / 4);
    /* eslint-disable no-new, handle-callback-err */

    new Decrypter(encrypted, key, iv, function (err, bytes) {
      self.postMessage(createTransferableMessage({
        source: data.source,
        decrypted: bytes
      }), [bytes.buffer]);
    });
    /* eslint-enable */
  };
}));
var Decrypter = factory(workerCode);
/* rollup-plugin-worker-factory end for worker!/home/runner/work/http-streaming/http-streaming/src/decrypter-worker.js */

/**
 * Convert the properties of an HLS track into an audioTrackKind.
 *
 * @private
 */

const audioTrackKind_ = properties => {
  let kind = properties.default ? 'main' : 'alternative';

  if (properties.characteristics && properties.characteristics.indexOf('public.accessibility.describes-video') >= 0) {
    kind = 'main-desc';
  }

  return kind;
};
/**
 * Pause provided segment loader and playlist loader if active
 *
 * @param {SegmentLoader} segmentLoader
 *        SegmentLoader to pause
 * @param {Object} mediaType
 *        Active media type
 * @function stopLoaders
 */


const stopLoaders = (segmentLoader, mediaType) => {
  segmentLoader.abort();
  segmentLoader.pause();

  if (mediaType && mediaType.activePlaylistLoader) {
    mediaType.activePlaylistLoader.pause();
    mediaType.activePlaylistLoader = null;
  }
};
/**
 * Start loading provided segment loader and playlist loader
 *
 * @param {PlaylistLoader} playlistLoader
 *        PlaylistLoader to start loading
 * @param {Object} mediaType
 *        Active media type
 * @function startLoaders
 */

const startLoaders = (playlistLoader, mediaType) => {
  // Segment loader will be started after `loadedmetadata` or `loadedplaylist` from the
  // playlist loader
  mediaType.activePlaylistLoader = playlistLoader;
  playlistLoader.load();
};
/**
 * Returns a function to be called when the media group changes. It performs a
 * non-destructive (preserve the buffer) resync of the SegmentLoader. This is because a
 * change of group is merely a rendition switch of the same content at another encoding,
 * rather than a change of content, such as switching audio from English to Spanish.
 *
 * @param {string} type
 *        MediaGroup type
 * @param {Object} settings
 *        Object containing required information for media groups
 * @return {Function}
 *         Handler for a non-destructive resync of SegmentLoader when the active media
 *         group changes.
 * @function onGroupChanged
 */

const onGroupChanged = (type, settings) => () => {
  const {
    segmentLoaders: {
      [type]: segmentLoader,
      main: mainSegmentLoader
    },
    mediaTypes: {
      [type]: mediaType
    }
  } = settings;
  const activeTrack = mediaType.activeTrack();
  const activeGroup = mediaType.getActiveGroup();
  const previousActiveLoader = mediaType.activePlaylistLoader;
  const lastGroup = mediaType.lastGroup_; // the group did not change do nothing

  if (activeGroup && lastGroup && activeGroup.id === lastGroup.id) {
    return;
  }

  mediaType.lastGroup_ = activeGroup;
  mediaType.lastTrack_ = activeTrack;
  stopLoaders(segmentLoader, mediaType);

  if (!activeGroup || activeGroup.isMainPlaylist) {
    // there is no group active or active group is a main playlist and won't change
    return;
  }

  if (!activeGroup.playlistLoader) {
    if (previousActiveLoader) {
      // The previous group had a playlist loader but the new active group does not
      // this means we are switching from demuxed to muxed audio. In this case we want to
      // do a destructive reset of the main segment loader and not restart the audio
      // loaders.
      mainSegmentLoader.resetEverything();
    }

    return;
  } // Non-destructive resync


  segmentLoader.resyncLoader();
  startLoaders(activeGroup.playlistLoader, mediaType);
};
const onGroupChanging = (type, settings) => () => {
  const {
    segmentLoaders: {
      [type]: segmentLoader
    },
    mediaTypes: {
      [type]: mediaType
    }
  } = settings;
  mediaType.lastGroup_ = null;
  segmentLoader.abort();
  segmentLoader.pause();
};
/**
 * Returns a function to be called when the media track changes. It performs a
 * destructive reset of the SegmentLoader to ensure we start loading as close to
 * currentTime as possible.
 *
 * @param {string} type
 *        MediaGroup type
 * @param {Object} settings
 *        Object containing required information for media groups
 * @return {Function}
 *         Handler for a destructive reset of SegmentLoader when the active media
 *         track changes.
 * @function onTrackChanged
 */

const onTrackChanged = (type, settings) => () => {
  const {
    mainPlaylistLoader,
    segmentLoaders: {
      [type]: segmentLoader,
      main: mainSegmentLoader
    },
    mediaTypes: {
      [type]: mediaType
    }
  } = settings;
  const activeTrack = mediaType.activeTrack();
  const activeGroup = mediaType.getActiveGroup();
  const previousActiveLoader = mediaType.activePlaylistLoader;
  const lastTrack = mediaType.lastTrack_; // track did not change, do nothing

  if (lastTrack && activeTrack && lastTrack.id === activeTrack.id) {
    return;
  }

  mediaType.lastGroup_ = activeGroup;
  mediaType.lastTrack_ = activeTrack;
  stopLoaders(segmentLoader, mediaType);

  if (!activeGroup) {
    // there is no group active so we do not want to restart loaders
    return;
  }

  if (activeGroup.isMainPlaylist) {
    // track did not change, do nothing
    if (!activeTrack || !lastTrack || activeTrack.id === lastTrack.id) {
      return;
    }

    const pc = settings.vhs.playlistController_;
    const newPlaylist = pc.selectPlaylist(); // media will not change do nothing

    if (pc.media() === newPlaylist) {
      return;
    }

    mediaType.logger_(`track change. Switching main audio from ${lastTrack.id} to ${activeTrack.id}`);
    mainPlaylistLoader.pause();
    mainSegmentLoader.resetEverything();
    pc.fastQualityChange_(newPlaylist);
    return;
  }

  if (type === 'AUDIO') {
    if (!activeGroup.playlistLoader) {
      // when switching from demuxed audio/video to muxed audio/video (noted by no
      // playlist loader for the audio group), we want to do a destructive reset of the
      // main segment loader and not restart the audio loaders
      mainSegmentLoader.setAudio(true); // don't have to worry about disabling the audio of the audio segment loader since
      // it should be stopped

      mainSegmentLoader.resetEverything();
      return;
    } // although the segment loader is an audio segment loader, call the setAudio
    // function to ensure it is prepared to re-append the init segment (or handle other
    // config changes)


    segmentLoader.setAudio(true);
    mainSegmentLoader.setAudio(false);
  }

  if (previousActiveLoader === activeGroup.playlistLoader) {
    // Nothing has actually changed. This can happen because track change events can fire
    // multiple times for a "single" change. One for enabling the new active track, and
    // one for disabling the track that was active
    startLoaders(activeGroup.playlistLoader, mediaType);
    return;
  }

  if (segmentLoader.track) {
    // For WebVTT, set the new text track in the segmentloader
    segmentLoader.track(activeTrack);
  } // destructive reset


  segmentLoader.resetEverything();
  startLoaders(activeGroup.playlistLoader, mediaType);
};
const onError = {
  /**
   * Returns a function to be called when a SegmentLoader or PlaylistLoader encounters
   * an error.
   *
   * @param {string} type
   *        MediaGroup type
   * @param {Object} settings
   *        Object containing required information for media groups
   * @return {Function}
   *         Error handler. Logs warning (or error if the playlist is excluded) to
   *         console and switches back to default audio track.
   * @function onError.AUDIO
   */
  AUDIO: (type, settings) => () => {
    const {
      mediaTypes: {
        [type]: mediaType
      },
      excludePlaylist
    } = settings; // switch back to default audio track

    const activeTrack = mediaType.activeTrack();
    const activeGroup = mediaType.activeGroup();
    const id = (activeGroup.filter(group => group.default)[0] || activeGroup[0]).id;
    const defaultTrack = mediaType.tracks[id];

    if (activeTrack === defaultTrack) {
      // Default track encountered an error. All we can do now is exclude the current
      // rendition and hope another will switch audio groups
      excludePlaylist({
        error: {
          message: 'Problem encountered loading the default audio track.'
        }
      });
      return;
    }

    videojs.log.warn('Problem encountered loading the alternate audio track.' + 'Switching back to default.');

    for (const trackId in mediaType.tracks) {
      mediaType.tracks[trackId].enabled = mediaType.tracks[trackId] === defaultTrack;
    }

    mediaType.onTrackChanged();
  },

  /**
   * Returns a function to be called when a SegmentLoader or PlaylistLoader encounters
   * an error.
   *
   * @param {string} type
   *        MediaGroup type
   * @param {Object} settings
   *        Object containing required information for media groups
   * @return {Function}
   *         Error handler. Logs warning to console and disables the active subtitle track
   * @function onError.SUBTITLES
   */
  SUBTITLES: (type, settings) => () => {
    const {
      mediaTypes: {
        [type]: mediaType
      }
    } = settings;
    videojs.log.warn('Problem encountered loading the subtitle track.' + 'Disabling subtitle track.');
    const track = mediaType.activeTrack();

    if (track) {
      track.mode = 'disabled';
    }

    mediaType.onTrackChanged();
  }
};
const setupListeners = {
  /**
   * Setup event listeners for audio playlist loader
   *
   * @param {string} type
   *        MediaGroup type
   * @param {PlaylistLoader|null} playlistLoader
   *        PlaylistLoader to register listeners on
   * @param {Object} settings
   *        Object containing required information for media groups
   * @function setupListeners.AUDIO
   */
  AUDIO: (type, playlistLoader, settings) => {
    if (!playlistLoader) {
      // no playlist loader means audio will be muxed with the video
      return;
    }

    const {
      tech,
      requestOptions,
      segmentLoaders: {
        [type]: segmentLoader
      }
    } = settings;
    playlistLoader.on('loadedmetadata', () => {
      const media = playlistLoader.media();
      segmentLoader.playlist(media, requestOptions); // if the video is already playing, or if this isn't a live video and preload
      // permits, start downloading segments

      if (!tech.paused() || media.endList && tech.preload() !== 'none') {
        segmentLoader.load();
      }
    });
    playlistLoader.on('loadedplaylist', () => {
      segmentLoader.playlist(playlistLoader.media(), requestOptions); // If the player isn't paused, ensure that the segment loader is running

      if (!tech.paused()) {
        segmentLoader.load();
      }
    });
    playlistLoader.on('error', onError[type](type, settings));
  },

  /**
   * Setup event listeners for subtitle playlist loader
   *
   * @param {string} type
   *        MediaGroup type
   * @param {PlaylistLoader|null} playlistLoader
   *        PlaylistLoader to register listeners on
   * @param {Object} settings
   *        Object containing required information for media groups
   * @function setupListeners.SUBTITLES
   */
  SUBTITLES: (type, playlistLoader, settings) => {
    const {
      tech,
      requestOptions,
      segmentLoaders: {
        [type]: segmentLoader
      },
      mediaTypes: {
        [type]: mediaType
      }
    } = settings;
    playlistLoader.on('loadedmetadata', () => {
      const media = playlistLoader.media();
      segmentLoader.playlist(media, requestOptions);
      segmentLoader.track(mediaType.activeTrack()); // if the video is already playing, or if this isn't a live video and preload
      // permits, start downloading segments

      if (!tech.paused() || media.endList && tech.preload() !== 'none') {
        segmentLoader.load();
      }
    });
    playlistLoader.on('loadedplaylist', () => {
      segmentLoader.playlist(playlistLoader.media(), requestOptions); // If the player isn't paused, ensure that the segment loader is running

      if (!tech.paused()) {
        segmentLoader.load();
      }
    });
    playlistLoader.on('error', onError[type](type, settings));
  }
};
const initialize = {
  /**
   * Setup PlaylistLoaders and AudioTracks for the audio groups
   *
   * @param {string} type
   *        MediaGroup type
   * @param {Object} settings
   *        Object containing required information for media groups
   * @function initialize.AUDIO
   */
  'AUDIO': (type, settings) => {
    const {
      vhs,
      sourceType,
      segmentLoaders: {
        [type]: segmentLoader
      },
      requestOptions,
      main: {
        mediaGroups
      },
      mediaTypes: {
        [type]: {
          groups,
          tracks,
          logger_
        }
      },
      mainPlaylistLoader
    } = settings;
    const audioOnlyMain = isAudioOnly(mainPlaylistLoader.main); // force a default if we have none

    if (!mediaGroups[type] || Object.keys(mediaGroups[type]).length === 0) {
      mediaGroups[type] = {
        main: {
          default: {
            default: true
          }
        }
      };

      if (audioOnlyMain) {
        mediaGroups[type].main.default.playlists = mainPlaylistLoader.main.playlists;
      }
    }

    for (const groupId in mediaGroups[type]) {
      if (!groups[groupId]) {
        groups[groupId] = [];
      }

      for (const variantLabel in mediaGroups[type][groupId]) {
        let properties = mediaGroups[type][groupId][variantLabel];
        let playlistLoader;

        if (audioOnlyMain) {
          logger_(`AUDIO group '${groupId}' label '${variantLabel}' is a main playlist`);
          properties.isMainPlaylist = true;
          playlistLoader = null; // if vhs-json was provided as the source, and the media playlist was resolved,
          // use the resolved media playlist object
        } else if (sourceType === 'vhs-json' && properties.playlists) {
          playlistLoader = new PlaylistLoader(properties.playlists[0], vhs, requestOptions);
        } else if (properties.resolvedUri) {
          playlistLoader = new PlaylistLoader(properties.resolvedUri, vhs, requestOptions); // TODO: dash isn't the only type with properties.playlists
          // should we even have properties.playlists in this check.
        } else if (properties.playlists && sourceType === 'dash') {
          playlistLoader = new DashPlaylistLoader(properties.playlists[0], vhs, requestOptions, mainPlaylistLoader);
        } else {
          // no resolvedUri means the audio is muxed with the video when using this
          // audio track
          playlistLoader = null;
        }

        properties = merge({
          id: variantLabel,
          playlistLoader
        }, properties);
        setupListeners[type](type, properties.playlistLoader, settings);
        groups[groupId].push(properties);

        if (typeof tracks[variantLabel] === 'undefined') {
          const track = new videojs.AudioTrack({
            id: variantLabel,
            kind: audioTrackKind_(properties),
            enabled: false,
            language: properties.language,
            default: properties.default,
            label: variantLabel
          });
          tracks[variantLabel] = track;
        }
      }
    } // setup single error event handler for the segment loader


    segmentLoader.on('error', onError[type](type, settings));
  },

  /**
   * Setup PlaylistLoaders and TextTracks for the subtitle groups
   *
   * @param {string} type
   *        MediaGroup type
   * @param {Object} settings
   *        Object containing required information for media groups
   * @function initialize.SUBTITLES
   */
  'SUBTITLES': (type, settings) => {
    const {
      tech,
      vhs,
      sourceType,
      segmentLoaders: {
        [type]: segmentLoader
      },
      requestOptions,
      main: {
        mediaGroups
      },
      mediaTypes: {
        [type]: {
          groups,
          tracks
        }
      },
      mainPlaylistLoader
    } = settings;

    for (const groupId in mediaGroups[type]) {
      if (!groups[groupId]) {
        groups[groupId] = [];
      }

      for (const variantLabel in mediaGroups[type][groupId]) {
        if (!vhs.options_.useForcedSubtitles && mediaGroups[type][groupId][variantLabel].forced) {
          // Subtitle playlists with the forced attribute are not selectable in Safari.
          // According to Apple's HLS Authoring Specification:
          //   If content has forced subtitles and regular subtitles in a given language,
          //   the regular subtitles track in that language MUST contain both the forced
          //   subtitles and the regular subtitles for that language.
          // Because of this requirement and that Safari does not add forced subtitles,
          // forced subtitles are skipped here to maintain consistent experience across
          // all platforms
          continue;
        }

        let properties = mediaGroups[type][groupId][variantLabel];
        let playlistLoader;

        if (sourceType === 'hls') {
          playlistLoader = new PlaylistLoader(properties.resolvedUri, vhs, requestOptions);
        } else if (sourceType === 'dash') {
          const playlists = properties.playlists.filter(p => p.excludeUntil !== Infinity);

          if (!playlists.length) {
            return;
          }

          playlistLoader = new DashPlaylistLoader(properties.playlists[0], vhs, requestOptions, mainPlaylistLoader);
        } else if (sourceType === 'vhs-json') {
          playlistLoader = new PlaylistLoader( // if the vhs-json object included the media playlist, use the media playlist
          // as provided, otherwise use the resolved URI to load the playlist
          properties.playlists ? properties.playlists[0] : properties.resolvedUri, vhs, requestOptions);
        }

        properties = merge({
          id: variantLabel,
          playlistLoader
        }, properties);
        setupListeners[type](type, properties.playlistLoader, settings);
        groups[groupId].push(properties);

        if (typeof tracks[variantLabel] === 'undefined') {
          const track = tech.addRemoteTextTrack({
            id: variantLabel,
            kind: 'subtitles',
            default: properties.default && properties.autoselect,
            language: properties.language,
            label: variantLabel
          }, false).track;
          tracks[variantLabel] = track;
        }
      }
    } // setup single error event handler for the segment loader


    segmentLoader.on('error', onError[type](type, settings));
  },

  /**
   * Setup TextTracks for the closed-caption groups
   *
   * @param {String} type
   *        MediaGroup type
   * @param {Object} settings
   *        Object containing required information for media groups
   * @function initialize['CLOSED-CAPTIONS']
   */
  'CLOSED-CAPTIONS': (type, settings) => {
    const {
      tech,
      main: {
        mediaGroups
      },
      mediaTypes: {
        [type]: {
          groups,
          tracks
        }
      }
    } = settings;

    for (const groupId in mediaGroups[type]) {
      if (!groups[groupId]) {
        groups[groupId] = [];
      }

      for (const variantLabel in mediaGroups[type][groupId]) {
        const properties = mediaGroups[type][groupId][variantLabel]; // Look for either 608 (CCn) or 708 (SERVICEn) caption services

        if (!/^(?:CC|SERVICE)/.test(properties.instreamId)) {
          continue;
        }

        const captionServices = tech.options_.vhs && tech.options_.vhs.captionServices || {};
        let newProps = {
          label: variantLabel,
          language: properties.language,
          instreamId: properties.instreamId,
          default: properties.default && properties.autoselect
        };

        if (captionServices[newProps.instreamId]) {
          newProps = merge(newProps, captionServices[newProps.instreamId]);
        }

        if (newProps.default === undefined) {
          delete newProps.default;
        } // No PlaylistLoader is required for Closed-Captions because the captions are
        // embedded within the video stream


        groups[groupId].push(merge({
          id: variantLabel
        }, properties));

        if (typeof tracks[variantLabel] === 'undefined') {
          const track = tech.addRemoteTextTrack({
            id: newProps.instreamId,
            kind: 'captions',
            default: newProps.default,
            language: newProps.language,
            label: newProps.label
          }, false).track;
          tracks[variantLabel] = track;
        }
      }
    }
  }
};

const groupMatch = (list, media) => {
  for (let i = 0; i < list.length; i++) {
    if (playlistMatch(media, list[i])) {
      return true;
    }

    if (list[i].playlists && groupMatch(list[i].playlists, media)) {
      return true;
    }
  }

  return false;
};
/**
 * Returns a function used to get the active group of the provided type
 *
 * @param {string} type
 *        MediaGroup type
 * @param {Object} settings
 *        Object containing required information for media groups
 * @return {Function}
 *         Function that returns the active media group for the provided type. Takes an
 *         optional parameter {TextTrack} track. If no track is provided, a list of all
 *         variants in the group, otherwise the variant corresponding to the provided
 *         track is returned.
 * @function activeGroup
 */


const activeGroup = (type, settings) => track => {
  const {
    mainPlaylistLoader,
    mediaTypes: {
      [type]: {
        groups
      }
    }
  } = settings;
  const media = mainPlaylistLoader.media();

  if (!media) {
    return null;
  }

  let variants = null; // set to variants to main media active group

  if (media.attributes[type]) {
    variants = groups[media.attributes[type]];
  }

  const groupKeys = Object.keys(groups);

  if (!variants) {
    // find the mainPlaylistLoader media
    // that is in a media group if we are dealing
    // with audio only
    if (type === 'AUDIO' && groupKeys.length > 1 && isAudioOnly(settings.main)) {
      for (let i = 0; i < groupKeys.length; i++) {
        const groupPropertyList = groups[groupKeys[i]];

        if (groupMatch(groupPropertyList, media)) {
          variants = groupPropertyList;
          break;
        }
      } // use the main group if it exists

    } else if (groups.main) {
      variants = groups.main; // only one group, use that one
    } else if (groupKeys.length === 1) {
      variants = groups[groupKeys[0]];
    }
  }

  if (typeof track === 'undefined') {
    return variants;
  }

  if (track === null || !variants) {
    // An active track was specified so a corresponding group is expected. track === null
    // means no track is currently active so there is no corresponding group
    return null;
  }

  return variants.filter(props => props.id === track.id)[0] || null;
};
const activeTrack = {
  /**
   * Returns a function used to get the active track of type provided
   *
   * @param {string} type
   *        MediaGroup type
   * @param {Object} settings
   *        Object containing required information for media groups
   * @return {Function}
   *         Function that returns the active media track for the provided type. Returns
   *         null if no track is active
   * @function activeTrack.AUDIO
   */
  AUDIO: (type, settings) => () => {
    const {
      mediaTypes: {
        [type]: {
          tracks
        }
      }
    } = settings;

    for (const id in tracks) {
      if (tracks[id].enabled) {
        return tracks[id];
      }
    }

    return null;
  },

  /**
   * Returns a function used to get the active track of type provided
   *
   * @param {string} type
   *        MediaGroup type
   * @param {Object} settings
   *        Object containing required information for media groups
   * @return {Function}
   *         Function that returns the active media track for the provided type. Returns
   *         null if no track is active
   * @function activeTrack.SUBTITLES
   */
  SUBTITLES: (type, settings) => () => {
    const {
      mediaTypes: {
        [type]: {
          tracks
        }
      }
    } = settings;

    for (const id in tracks) {
      if (tracks[id].mode === 'showing' || tracks[id].mode === 'hidden') {
        return tracks[id];
      }
    }

    return null;
  }
};
const getActiveGroup = (type, {
  mediaTypes
}) => () => {
  const activeTrack_ = mediaTypes[type].activeTrack();

  if (!activeTrack_) {
    return null;
  }

  return mediaTypes[type].activeGroup(activeTrack_);
};
/**
 * Setup PlaylistLoaders and Tracks for media groups (Audio, Subtitles,
 * Closed-Captions) specified in the main manifest.
 *
 * @param {Object} settings
 *        Object containing required information for setting up the media groups
 * @param {Tech} settings.tech
 *        The tech of the player
 * @param {Object} settings.requestOptions
 *        XHR request options used by the segment loaders
 * @param {PlaylistLoader} settings.mainPlaylistLoader
 *        PlaylistLoader for the main source
 * @param {VhsHandler} settings.vhs
 *        VHS SourceHandler
 * @param {Object} settings.main
 *        The parsed main manifest
 * @param {Object} settings.mediaTypes
 *        Object to store the loaders, tracks, and utility methods for each media type
 * @param {Function} settings.excludePlaylist
 *        Excludes the current rendition and forces a rendition switch.
 * @function setupMediaGroups
 */

const setupMediaGroups = settings => {
  ['AUDIO', 'SUBTITLES', 'CLOSED-CAPTIONS'].forEach(type => {
    initialize[type](type, settings);
  });
  const {
    mediaTypes,
    mainPlaylistLoader,
    tech,
    vhs,
    segmentLoaders: {
      ['AUDIO']: audioSegmentLoader,
      main: mainSegmentLoader
    }
  } = settings; // setup active group and track getters and change event handlers

  ['AUDIO', 'SUBTITLES'].forEach(type => {
    mediaTypes[type].activeGroup = activeGroup(type, settings);
    mediaTypes[type].activeTrack = activeTrack[type](type, settings);
    mediaTypes[type].onGroupChanged = onGroupChanged(type, settings);
    mediaTypes[type].onGroupChanging = onGroupChanging(type, settings);
    mediaTypes[type].onTrackChanged = onTrackChanged(type, settings);
    mediaTypes[type].getActiveGroup = getActiveGroup(type, settings);
  }); // DO NOT enable the default subtitle or caption track.
  // DO enable the default audio track

  const audioGroup = mediaTypes.AUDIO.activeGroup();

  if (audioGroup) {
    const groupId = (audioGroup.filter(group => group.default)[0] || audioGroup[0]).id;
    mediaTypes.AUDIO.tracks[groupId].enabled = true;
    mediaTypes.AUDIO.onGroupChanged();
    mediaTypes.AUDIO.onTrackChanged();
    const activeAudioGroup = mediaTypes.AUDIO.getActiveGroup(); // a similar check for handling setAudio on each loader is run again each time the
    // track is changed, but needs to be handled here since the track may not be considered
    // changed on the first call to onTrackChanged

    if (!activeAudioGroup.playlistLoader) {
      // either audio is muxed with video or the stream is audio only
      mainSegmentLoader.setAudio(true);
    } else {
      // audio is demuxed
      mainSegmentLoader.setAudio(false);
      audioSegmentLoader.setAudio(true);
    }
  }

  mainPlaylistLoader.on('mediachange', () => {
    ['AUDIO', 'SUBTITLES'].forEach(type => mediaTypes[type].onGroupChanged());
  });
  mainPlaylistLoader.on('mediachanging', () => {
    ['AUDIO', 'SUBTITLES'].forEach(type => mediaTypes[type].onGroupChanging());
  }); // custom audio track change event handler for usage event

  const onAudioTrackChanged = () => {
    mediaTypes.AUDIO.onTrackChanged();
    tech.trigger({
      type: 'usage',
      name: 'vhs-audio-change'
    });
  };

  tech.audioTracks().addEventListener('change', onAudioTrackChanged);
  tech.remoteTextTracks().addEventListener('change', mediaTypes.SUBTITLES.onTrackChanged);
  vhs.on('dispose', () => {
    tech.audioTracks().removeEventListener('change', onAudioTrackChanged);
    tech.remoteTextTracks().removeEventListener('change', mediaTypes.SUBTITLES.onTrackChanged);
  }); // clear existing audio tracks and add the ones we just created

  tech.clearTracks('audio');

  for (const id in mediaTypes.AUDIO.tracks) {
    tech.audioTracks().addTrack(mediaTypes.AUDIO.tracks[id]);
  }
};
/**
 * Creates skeleton object used to store the loaders, tracks, and utility methods for each
 * media type
 *
 * @return {Object}
 *         Object to store the loaders, tracks, and utility methods for each media type
 * @function createMediaTypes
 */

const createMediaTypes = () => {
  const mediaTypes = {};
  ['AUDIO', 'SUBTITLES', 'CLOSED-CAPTIONS'].forEach(type => {
    mediaTypes[type] = {
      groups: {},
      tracks: {},
      activePlaylistLoader: null,
      activeGroup: noop,
      activeTrack: noop,
      getActiveGroup: noop,
      onGroupChanged: noop,
      onTrackChanged: noop,
      lastTrack_: null,
      logger_: logger(`MediaGroups[${type}]`)
    };
  });
  return mediaTypes;
};

/**
 * A utility class for setting properties and maintaining the state of the content steering manifest.
 *
 * Content Steering manifest format:
 * VERSION: number (required) currently only version 1 is supported.
 * TTL: number in seconds (optional) until the next content steering manifest reload.
 * RELOAD-URI: string (optional) uri to fetch the next content steering manifest.
 * SERVICE-LOCATION-PRIORITY or PATHWAY-PRIORITY a non empty array of unique string values.
 * PATHWAY-CLONES: array (optional) (HLS only) pathway clone objects to copy from other playlists.
 */

class SteeringManifest {
  constructor() {
    this.priority_ = [];
    this.pathwayClones_ = new Map();
  }

  set version(number) {
    // Only version 1 is currently supported for both DASH and HLS.
    if (number === 1) {
      this.version_ = number;
    }
  }

  set ttl(seconds) {
    // TTL = time-to-live, default = 300 seconds.
    this.ttl_ = seconds || 300;
  }

  set reloadUri(uri) {
    if (uri) {
      // reload URI can be relative to the previous reloadUri.
      this.reloadUri_ = resolveUrl(this.reloadUri_, uri);
    }
  }

  set priority(array) {
    // priority must be non-empty and unique values.
    if (array && array.length) {
      this.priority_ = array;
    }
  }

  set pathwayClones(array) {
    // pathwayClones must be non-empty.
    if (array && array.length) {
      this.pathwayClones_ = new Map(array.map(clone => [clone.ID, clone]));
    }
  }

  get version() {
    return this.version_;
  }

  get ttl() {
    return this.ttl_;
  }

  get reloadUri() {
    return this.reloadUri_;
  }

  get priority() {
    return this.priority_;
  }

  get pathwayClones() {
    return this.pathwayClones_;
  }

}
/**
 * This class represents a content steering manifest and associated state. See both HLS and DASH specifications.
 * HLS: https://developer.apple.com/streaming/HLSContentSteeringSpecification.pdf and
 * https://datatracker.ietf.org/doc/draft-pantos-hls-rfc8216bis/ section 4.4.6.6.
 * DASH: https://dashif.org/docs/DASH-IF-CTS-00XX-Content-Steering-Community-Review.pdf
 *
 * @param {function} xhr for making a network request from the browser.
 * @param {function} bandwidth for fetching the current bandwidth from the main segment loader.
 */


class ContentSteeringController extends videojs.EventTarget {
  constructor(xhr, bandwidth) {
    super();
    this.currentPathway = null;
    this.defaultPathway = null;
    this.queryBeforeStart = false;
    this.availablePathways_ = new Set();
    this.steeringManifest = new SteeringManifest();
    this.proxyServerUrl_ = null;
    this.manifestType_ = null;
    this.ttlTimeout_ = null;
    this.request_ = null;
    this.currentPathwayClones = new Map();
    this.nextPathwayClones = new Map();
    this.excludedSteeringManifestURLs = new Set();
    this.logger_ = logger('Content Steering');
    this.xhr_ = xhr;
    this.getBandwidth_ = bandwidth;
  }
  /**
   * Assigns the content steering tag properties to the steering controller
   *
   * @param {string} baseUrl the baseURL from the main manifest for resolving the steering manifest url
   * @param {Object} steeringTag the content steering tag from the main manifest
   */


  assignTagProperties(baseUrl, steeringTag) {
    this.manifestType_ = steeringTag.serverUri ? 'HLS' : 'DASH'; // serverUri is HLS serverURL is DASH

    const steeringUri = steeringTag.serverUri || steeringTag.serverURL;

    if (!steeringUri) {
      this.logger_(`steering manifest URL is ${steeringUri}, cannot request steering manifest.`);
      this.trigger('error');
      return;
    } // Content steering manifests can be encoded as a data URI. We can decode, parse and return early if that's the case.


    if (steeringUri.startsWith('data:')) {
      this.decodeDataUriManifest_(steeringUri.substring(steeringUri.indexOf(',') + 1));
      return;
    } // reloadUri is the resolution of the main manifest URL and steering URL.


    this.steeringManifest.reloadUri = resolveUrl(baseUrl, steeringUri); // pathwayId is HLS defaultServiceLocation is DASH

    this.defaultPathway = steeringTag.pathwayId || steeringTag.defaultServiceLocation; // currently only DASH supports the following properties on <ContentSteering> tags.

    this.queryBeforeStart = steeringTag.queryBeforeStart;
    this.proxyServerUrl_ = steeringTag.proxyServerURL; // trigger a steering event if we have a pathway from the content steering tag.
    // this tells VHS which segment pathway to start with.
    // If queryBeforeStart is true we need to wait for the steering manifest response.

    if (this.defaultPathway && !this.queryBeforeStart) {
      this.trigger('content-steering');
    }
  }
  /**
   * Requests the content steering manifest and parse the response. This should only be called after
   * assignTagProperties was called with a content steering tag.
   *
   * @param {string} initialUri The optional uri to make the request with.
   *    If set, the request should be made with exactly what is passed in this variable.
   *    This scenario should only happen once on initalization.
   */


  requestSteeringManifest(initial) {
    const reloadUri = this.steeringManifest.reloadUri;

    if (!reloadUri) {
      return;
    } // We currently don't support passing MPD query parameters directly to the content steering URL as this requires
    // ExtUrlQueryInfo tag support. See the DASH content steering spec section 8.1.
    // This request URI accounts for manifest URIs that have been excluded.


    const uri = initial ? reloadUri : this.getRequestURI(reloadUri); // If there are no valid manifest URIs, we should stop content steering.

    if (!uri) {
      this.logger_('No valid content steering manifest URIs. Stopping content steering.');
      this.trigger('error');
      this.dispose();
      return;
    }

    this.request_ = this.xhr_({
      uri
    }, (error, errorInfo) => {
      if (error) {
        // If the client receives HTTP 410 Gone in response to a manifest request,
        // it MUST NOT issue another request for that URI for the remainder of the
        // playback session. It MAY continue to use the most-recently obtained set
        // of Pathways.
        if (errorInfo.status === 410) {
          this.logger_(`manifest request 410 ${error}.`);
          this.logger_(`There will be no more content steering requests to ${uri} this session.`);
          this.excludedSteeringManifestURLs.add(uri);
          return;
        } // If the client receives HTTP 429 Too Many Requests with a Retry-After
        // header in response to a manifest request, it SHOULD wait until the time
        // specified by the Retry-After header to reissue the request.


        if (errorInfo.status === 429) {
          const retrySeconds = errorInfo.responseHeaders['retry-after'];
          this.logger_(`manifest request 429 ${error}.`);
          this.logger_(`content steering will retry in ${retrySeconds} seconds.`);
          this.startTTLTimeout_(parseInt(retrySeconds, 10));
          return;
        } // If the Steering Manifest cannot be loaded and parsed correctly, the
        // client SHOULD continue to use the previous values and attempt to reload
        // it after waiting for the previously-specified TTL (or 5 minutes if
        // none).


        this.logger_(`manifest failed to load ${error}.`);
        this.startTTLTimeout_();
        return;
      }

      const steeringManifestJson = JSON.parse(this.request_.responseText);
      this.assignSteeringProperties_(steeringManifestJson);
      this.startTTLTimeout_();
    });
  }
  /**
   * Set the proxy server URL and add the steering manifest url as a URI encoded parameter.
   *
   * @param {string} steeringUrl the steering manifest url
   * @return the steering manifest url to a proxy server with all parameters set
   */


  setProxyServerUrl_(steeringUrl) {
    const steeringUrlObject = new window$1.URL(steeringUrl);
    const proxyServerUrlObject = new window$1.URL(this.proxyServerUrl_);
    proxyServerUrlObject.searchParams.set('url', encodeURI(steeringUrlObject.toString()));
    return this.setSteeringParams_(proxyServerUrlObject.toString());
  }
  /**
   * Decodes and parses the data uri encoded steering manifest
   *
   * @param {string} dataUri the data uri to be decoded and parsed.
   */


  decodeDataUriManifest_(dataUri) {
    const steeringManifestJson = JSON.parse(window$1.atob(dataUri));
    this.assignSteeringProperties_(steeringManifestJson);
  }
  /**
   * Set the HLS or DASH content steering manifest request query parameters. For example:
   * _HLS_pathway="<CURRENT-PATHWAY-ID>" and _HLS_throughput=<THROUGHPUT>
   * _DASH_pathway and _DASH_throughput
   *
   * @param {string} uri to add content steering server parameters to.
   * @return a new uri as a string with the added steering query parameters.
   */


  setSteeringParams_(url) {
    const urlObject = new window$1.URL(url);
    const path = this.getPathway();
    const networkThroughput = this.getBandwidth_();

    if (path) {
      const pathwayKey = `_${this.manifestType_}_pathway`;
      urlObject.searchParams.set(pathwayKey, path);
    }

    if (networkThroughput) {
      const throughputKey = `_${this.manifestType_}_throughput`;
      urlObject.searchParams.set(throughputKey, networkThroughput);
    }

    return urlObject.toString();
  }
  /**
   * Assigns the current steering manifest properties and to the SteeringManifest object
   *
   * @param {Object} steeringJson the raw JSON steering manifest
   */


  assignSteeringProperties_(steeringJson) {
    this.steeringManifest.version = steeringJson.VERSION;

    if (!this.steeringManifest.version) {
      this.logger_(`manifest version is ${steeringJson.VERSION}, which is not supported.`);
      this.trigger('error');
      return;
    }

    this.steeringManifest.ttl = steeringJson.TTL;
    this.steeringManifest.reloadUri = steeringJson['RELOAD-URI']; // HLS = PATHWAY-PRIORITY required. DASH = SERVICE-LOCATION-PRIORITY optional

    this.steeringManifest.priority = steeringJson['PATHWAY-PRIORITY'] || steeringJson['SERVICE-LOCATION-PRIORITY']; // Pathway clones to be created/updated in HLS.
    // See section 7.2 https://datatracker.ietf.org/doc/draft-pantos-hls-rfc8216bis/

    this.steeringManifest.pathwayClones = steeringJson['PATHWAY-CLONES'];
    this.nextPathwayClones = this.steeringManifest.pathwayClones; // 1. apply first pathway from the array.
    // 2. if first pathway doesn't exist in manifest, try next pathway.
    //    a. if all pathways are exhausted, ignore the steering manifest priority.
    // 3. if segments fail from an established pathway, try all variants/renditions, then exclude the failed pathway.
    //    a. exclude a pathway for a minimum of the last TTL duration. Meaning, from the next steering response,
    //       the excluded pathway will be ignored.
    //       See excludePathway usage in excludePlaylist().
    // If there are no available pathways, we need to stop content steering.

    if (!this.availablePathways_.size) {
      this.logger_('There are no available pathways for content steering. Ending content steering.');
      this.trigger('error');
      this.dispose();
    }

    const chooseNextPathway = pathwaysByPriority => {
      for (const path of pathwaysByPriority) {
        if (this.availablePathways_.has(path)) {
          return path;
        }
      } // If no pathway matches, ignore the manifest and choose the first available.


      return [...this.availablePathways_][0];
    };

    const nextPathway = chooseNextPathway(this.steeringManifest.priority);

    if (this.currentPathway !== nextPathway) {
      this.currentPathway = nextPathway;
      this.trigger('content-steering');
    }
  }
  /**
   * Returns the pathway to use for steering decisions
   *
   * @return {string} returns the current pathway or the default
   */


  getPathway() {
    return this.currentPathway || this.defaultPathway;
  }
  /**
   * Chooses the manifest request URI based on proxy URIs and server URLs.
   * Also accounts for exclusion on certain manifest URIs.
   *
   * @param {string} reloadUri the base uri before parameters
   *
   * @return {string} the final URI for the request to the manifest server.
   */


  getRequestURI(reloadUri) {
    if (!reloadUri) {
      return null;
    }

    const isExcluded = uri => this.excludedSteeringManifestURLs.has(uri);

    if (this.proxyServerUrl_) {
      const proxyURI = this.setProxyServerUrl_(reloadUri);

      if (!isExcluded(proxyURI)) {
        return proxyURI;
      }
    }

    const steeringURI = this.setSteeringParams_(reloadUri);

    if (!isExcluded(steeringURI)) {
      return steeringURI;
    } // Return nothing if all valid manifest URIs are excluded.


    return null;
  }
  /**
   * Start the timeout for re-requesting the steering manifest at the TTL interval.
   *
   * @param {number} ttl time in seconds of the timeout. Defaults to the
   *        ttl interval in the steering manifest
   */


  startTTLTimeout_(ttl = this.steeringManifest.ttl) {
    // 300 (5 minutes) is the default value.
    const ttlMS = ttl * 1000;
    this.ttlTimeout_ = window$1.setTimeout(() => {
      this.requestSteeringManifest();
    }, ttlMS);
  }
  /**
   * Clear the TTL timeout if necessary.
   */


  clearTTLTimeout_() {
    window$1.clearTimeout(this.ttlTimeout_);
    this.ttlTimeout_ = null;
  }
  /**
   * aborts any current steering xhr and sets the current request object to null
   */


  abort() {
    if (this.request_) {
      this.request_.abort();
    }

    this.request_ = null;
  }
  /**
   * aborts steering requests clears the ttl timeout and resets all properties.
   */


  dispose() {
    this.off('content-steering');
    this.off('error');
    this.abort();
    this.clearTTLTimeout_();
    this.currentPathway = null;
    this.defaultPathway = null;
    this.queryBeforeStart = null;
    this.proxyServerUrl_ = null;
    this.manifestType_ = null;
    this.ttlTimeout_ = null;
    this.request_ = null;
    this.excludedSteeringManifestURLs = new Set();
    this.availablePathways_ = new Set();
    this.steeringManifest = new SteeringManifest();
  }
  /**
   * adds a pathway to the available pathways set
   *
   * @param {string} pathway the pathway string to add
   */


  addAvailablePathway(pathway) {
    if (pathway) {
      this.availablePathways_.add(pathway);
    }
  }
  /**
   * Clears all pathways from the available pathways set
   */


  clearAvailablePathways() {
    this.availablePathways_.clear();
  }
  /**
   * Removes a pathway from the available pathways set.
   */


  excludePathway(pathway) {
    return this.availablePathways_.delete(pathway);
  }
  /**
   * Checks the refreshed DASH manifest content steering tag for changes.
   *
   * @param {string} baseURL new steering tag on DASH manifest refresh
   * @param {Object} newTag the new tag to check for changes
   * @return a true or false whether the new tag has different values
   */


  didDASHTagChange(baseURL, newTag) {
    return !newTag && this.steeringManifest.reloadUri || newTag && (resolveUrl(baseURL, newTag.serverURL) !== this.steeringManifest.reloadUri || newTag.defaultServiceLocation !== this.defaultPathway || newTag.queryBeforeStart !== this.queryBeforeStart || newTag.proxyServerURL !== this.proxyServerUrl_);
  }

  getAvailablePathways() {
    return this.availablePathways_;
  }

}

/**
 * @file playlist-controller.js
 */
const ABORT_EARLY_EXCLUSION_SECONDS = 10;
let Vhs$1; // SegmentLoader stats that need to have each loader's
// values summed to calculate the final value

const loaderStats = ['mediaRequests', 'mediaRequestsAborted', 'mediaRequestsTimedout', 'mediaRequestsErrored', 'mediaTransferDuration', 'mediaBytesTransferred', 'mediaAppends'];

const sumLoaderStat = function (stat) {
  return this.audioSegmentLoader_[stat] + this.mainSegmentLoader_[stat];
};

const shouldSwitchToMedia = function ({
  currentPlaylist,
  buffered,
  currentTime,
  nextPlaylist,
  bufferLowWaterLine,
  bufferHighWaterLine,
  duration,
  bufferBasedABR,
  log
}) {
  // we have no other playlist to switch to
  if (!nextPlaylist) {
    videojs.log.warn('We received no playlist to switch to. Please check your stream.');
    return false;
  }

  const sharedLogLine = `allowing switch ${currentPlaylist && currentPlaylist.id || 'null'} -> ${nextPlaylist.id}`;

  if (!currentPlaylist) {
    log(`${sharedLogLine} as current playlist is not set`);
    return true;
  } // no need to switch if playlist is the same


  if (nextPlaylist.id === currentPlaylist.id) {
    return false;
  } // determine if current time is in a buffered range.


  const isBuffered = Boolean(findRange(buffered, currentTime).length); // If the playlist is live, then we want to not take low water line into account.
  // This is because in LIVE, the player plays 3 segments from the end of the
  // playlist, and if `BUFFER_LOW_WATER_LINE` is greater than the duration availble
  // in those segments, a viewer will never experience a rendition upswitch.

  if (!currentPlaylist.endList) {
    // For LLHLS live streams, don't switch renditions before playback has started, as it almost
    // doubles the time to first playback.
    if (!isBuffered && typeof currentPlaylist.partTargetDuration === 'number') {
      log(`not ${sharedLogLine} as current playlist is live llhls, but currentTime isn't in buffered.`);
      return false;
    }

    log(`${sharedLogLine} as current playlist is live`);
    return true;
  }

  const forwardBuffer = timeAheadOf(buffered, currentTime);
  const maxBufferLowWaterLine = bufferBasedABR ? Config.EXPERIMENTAL_MAX_BUFFER_LOW_WATER_LINE : Config.MAX_BUFFER_LOW_WATER_LINE; // For the same reason as LIVE, we ignore the low water line when the VOD
  // duration is below the max potential low water line

  if (duration < maxBufferLowWaterLine) {
    log(`${sharedLogLine} as duration < max low water line (${duration} < ${maxBufferLowWaterLine})`);
    return true;
  }

  const nextBandwidth = nextPlaylist.attributes.BANDWIDTH;
  const currBandwidth = currentPlaylist.attributes.BANDWIDTH; // when switching down, if our buffer is lower than the high water line,
  // we can switch down

  if (nextBandwidth < currBandwidth && (!bufferBasedABR || forwardBuffer < bufferHighWaterLine)) {
    let logLine = `${sharedLogLine} as next bandwidth < current bandwidth (${nextBandwidth} < ${currBandwidth})`;

    if (bufferBasedABR) {
      logLine += ` and forwardBuffer < bufferHighWaterLine (${forwardBuffer} < ${bufferHighWaterLine})`;
    }

    log(logLine);
    return true;
  } // and if our buffer is higher than the low water line,
  // we can switch up


  if ((!bufferBasedABR || nextBandwidth > currBandwidth) && forwardBuffer >= bufferLowWaterLine) {
    let logLine = `${sharedLogLine} as forwardBuffer >= bufferLowWaterLine (${forwardBuffer} >= ${bufferLowWaterLine})`;

    if (bufferBasedABR) {
      logLine += ` and next bandwidth > current bandwidth (${nextBandwidth} > ${currBandwidth})`;
    }

    log(logLine);
    return true;
  }

  log(`not ${sharedLogLine} as no switching criteria met`);
  return false;
};
/**
 * the main playlist controller controller all interactons
 * between playlists and segmentloaders. At this time this mainly
 * involves a main playlist and a series of audio playlists
 * if they are available
 *
 * @class PlaylistController
 * @extends videojs.EventTarget
 */


class PlaylistController extends videojs.EventTarget {
  constructor(options) {
    super();
    const {
      src,
      withCredentials,
      tech,
      bandwidth,
      externVhs,
      useCueTags,
      playlistExclusionDuration,
      enableLowInitialPlaylist,
      sourceType,
      cacheEncryptionKeys,
      bufferBasedABR,
      leastPixelDiffSelector,
      captionServices
    } = options;

    if (!src) {
      throw new Error('A non-empty playlist URL or JSON manifest string is required');
    }

    let {
      maxPlaylistRetries
    } = options;

    if (maxPlaylistRetries === null || typeof maxPlaylistRetries === 'undefined') {
      maxPlaylistRetries = Infinity;
    }

    Vhs$1 = externVhs;
    this.bufferBasedABR = Boolean(bufferBasedABR);
    this.leastPixelDiffSelector = Boolean(leastPixelDiffSelector);
    this.withCredentials = withCredentials;
    this.tech_ = tech;
    this.vhs_ = tech.vhs;
    this.sourceType_ = sourceType;
    this.useCueTags_ = useCueTags;
    this.playlistExclusionDuration = playlistExclusionDuration;
    this.maxPlaylistRetries = maxPlaylistRetries;
    this.enableLowInitialPlaylist = enableLowInitialPlaylist;

    if (this.useCueTags_) {
      this.cueTagsTrack_ = this.tech_.addTextTrack('metadata', 'ad-cues');
      this.cueTagsTrack_.inBandMetadataTrackDispatchType = '';
    }

    this.requestOptions_ = {
      withCredentials,
      maxPlaylistRetries,
      timeout: null
    };
    this.on('error', this.pauseLoading);
    this.mediaTypes_ = createMediaTypes();
    this.mediaSource = new window$1.MediaSource();
    this.handleDurationChange_ = this.handleDurationChange_.bind(this);
    this.handleSourceOpen_ = this.handleSourceOpen_.bind(this);
    this.handleSourceEnded_ = this.handleSourceEnded_.bind(this);
    this.mediaSource.addEventListener('durationchange', this.handleDurationChange_); // load the media source into the player

    this.mediaSource.addEventListener('sourceopen', this.handleSourceOpen_);
    this.mediaSource.addEventListener('sourceended', this.handleSourceEnded_); // we don't have to handle sourceclose since dispose will handle termination of
    // everything, and the MediaSource should not be detached without a proper disposal

    this.seekable_ = createTimeRanges();
    this.hasPlayed_ = false;
    this.syncController_ = new SyncController(options);
    this.segmentMetadataTrack_ = tech.addRemoteTextTrack({
      kind: 'metadata',
      label: 'segment-metadata'
    }, false).track;
    this.decrypter_ = new Decrypter();
    this.sourceUpdater_ = new SourceUpdater(this.mediaSource);
    this.inbandTextTracks_ = {};
    this.timelineChangeController_ = new TimelineChangeController();
    this.keyStatusMap_ = new Map();
    const segmentLoaderSettings = {
      vhs: this.vhs_,
      parse708captions: options.parse708captions,
      useDtsForTimestampOffset: options.useDtsForTimestampOffset,
      captionServices,
      mediaSource: this.mediaSource,
      currentTime: this.tech_.currentTime.bind(this.tech_),
      seekable: () => this.seekable(),
      seeking: () => this.tech_.seeking(),
      duration: () => this.duration(),
      hasPlayed: () => this.hasPlayed_,
      goalBufferLength: () => this.goalBufferLength(),
      bandwidth,
      syncController: this.syncController_,
      decrypter: this.decrypter_,
      sourceType: this.sourceType_,
      inbandTextTracks: this.inbandTextTracks_,
      cacheEncryptionKeys,
      sourceUpdater: this.sourceUpdater_,
      timelineChangeController: this.timelineChangeController_,
      exactManifestTimings: options.exactManifestTimings,
      addMetadataToTextTrack: this.addMetadataToTextTrack.bind(this)
    }; // The source type check not only determines whether a special DASH playlist loader
    // should be used, but also covers the case where the provided src is a vhs-json
    // manifest object (instead of a URL). In the case of vhs-json, the default
    // PlaylistLoader should be used.

    this.mainPlaylistLoader_ = this.sourceType_ === 'dash' ? new DashPlaylistLoader(src, this.vhs_, merge(this.requestOptions_, {
      addMetadataToTextTrack: this.addMetadataToTextTrack.bind(this)
    })) : new PlaylistLoader(src, this.vhs_, merge(this.requestOptions_, {
      addDateRangesToTextTrack: this.addDateRangesToTextTrack_.bind(this)
    }));
    this.setupMainPlaylistLoaderListeners_(); // setup segment loaders
    // combined audio/video or just video when alternate audio track is selected

    this.mainSegmentLoader_ = new SegmentLoader(merge(segmentLoaderSettings, {
      segmentMetadataTrack: this.segmentMetadataTrack_,
      loaderType: 'main'
    }), options); // alternate audio track

    this.audioSegmentLoader_ = new SegmentLoader(merge(segmentLoaderSettings, {
      loaderType: 'audio'
    }), options);
    this.subtitleSegmentLoader_ = new VTTSegmentLoader(merge(segmentLoaderSettings, {
      loaderType: 'vtt',
      featuresNativeTextTracks: this.tech_.featuresNativeTextTracks,
      loadVttJs: () => new Promise((resolve, reject) => {
        function onLoad() {
          tech.off('vttjserror', onError);
          resolve();
        }

        function onError() {
          tech.off('vttjsloaded', onLoad);
          reject();
        }

        tech.one('vttjsloaded', onLoad);
        tech.one('vttjserror', onError); // safe to call multiple times, script will be loaded only once:

        tech.addWebVttScript_();
      })
    }), options);

    const getBandwidth = () => {
      return this.mainSegmentLoader_.bandwidth;
    };

    this.contentSteeringController_ = new ContentSteeringController(this.vhs_.xhr, getBandwidth);
    this.setupSegmentLoaderListeners_();

    if (this.bufferBasedABR) {
      this.mainPlaylistLoader_.one('loadedplaylist', () => this.startABRTimer_());
      this.tech_.on('pause', () => this.stopABRTimer_());
      this.tech_.on('play', () => this.startABRTimer_());
    } // Create SegmentLoader stat-getters
    // mediaRequests_
    // mediaRequestsAborted_
    // mediaRequestsTimedout_
    // mediaRequestsErrored_
    // mediaTransferDuration_
    // mediaBytesTransferred_
    // mediaAppends_


    loaderStats.forEach(stat => {
      this[stat + '_'] = sumLoaderStat.bind(this, stat);
    });
    this.logger_ = logger('pc');
    this.triggeredFmp4Usage = false;

    if (this.tech_.preload() === 'none') {
      this.loadOnPlay_ = () => {
        this.loadOnPlay_ = null;
        this.mainPlaylistLoader_.load();
      };

      this.tech_.one('play', this.loadOnPlay_);
    } else {
      this.mainPlaylistLoader_.load();
    }

    this.timeToLoadedData__ = -1;
    this.mainAppendsToLoadedData__ = -1;
    this.audioAppendsToLoadedData__ = -1;
    const event = this.tech_.preload() === 'none' ? 'play' : 'loadstart'; // start the first frame timer on loadstart or play (for preload none)

    this.tech_.one(event, () => {
      const timeToLoadedDataStart = Date.now();
      this.tech_.one('loadeddata', () => {
        this.timeToLoadedData__ = Date.now() - timeToLoadedDataStart;
        this.mainAppendsToLoadedData__ = this.mainSegmentLoader_.mediaAppends;
        this.audioAppendsToLoadedData__ = this.audioSegmentLoader_.mediaAppends;
      });
    });
  }

  mainAppendsToLoadedData_() {
    return this.mainAppendsToLoadedData__;
  }

  audioAppendsToLoadedData_() {
    return this.audioAppendsToLoadedData__;
  }

  appendsToLoadedData_() {
    const main = this.mainAppendsToLoadedData_();
    const audio = this.audioAppendsToLoadedData_();

    if (main === -1 || audio === -1) {
      return -1;
    }

    return main + audio;
  }

  timeToLoadedData_() {
    return this.timeToLoadedData__;
  }
  /**
   * Run selectPlaylist and switch to the new playlist if we should
   *
   * @param {string} [reason=abr] a reason for why the ABR check is made
   * @private
   */


  checkABR_(reason = 'abr') {
    const nextPlaylist = this.selectPlaylist();

    if (nextPlaylist && this.shouldSwitchToMedia_(nextPlaylist)) {
      this.switchMedia_(nextPlaylist, reason);
    }
  }

  switchMedia_(playlist, cause, delay) {
    const oldMedia = this.media();
    const oldId = oldMedia && (oldMedia.id || oldMedia.uri);
    const newId = playlist && (playlist.id || playlist.uri);

    if (oldId && oldId !== newId) {
      this.logger_(`switch media ${oldId} -> ${newId} from ${cause}`);
      this.tech_.trigger({
        type: 'usage',
        name: `vhs-rendition-change-${cause}`
      });
    }

    this.mainPlaylistLoader_.media(playlist, delay);
  }
  /**
   * A function that ensures we switch our playlists inside of `mediaTypes`
   * to match the current `serviceLocation` provided by the contentSteering controller.
   * We want to check media types of `AUDIO`, `SUBTITLES`, and `CLOSED-CAPTIONS`.
   *
   * This should only be called on a DASH playback scenario while using content steering.
   * This is necessary due to differences in how media in HLS manifests are generally tied to
   * a video playlist, where in DASH that is not always the case.
   */


  switchMediaForDASHContentSteering_() {
    ['AUDIO', 'SUBTITLES', 'CLOSED-CAPTIONS'].forEach(type => {
      const mediaType = this.mediaTypes_[type];
      const activeGroup = mediaType ? mediaType.activeGroup() : null;
      const pathway = this.contentSteeringController_.getPathway();

      if (activeGroup && pathway) {
        // activeGroup can be an array or a single group
        const mediaPlaylists = activeGroup.length ? activeGroup[0].playlists : activeGroup.playlists;
        const dashMediaPlaylists = mediaPlaylists.filter(p => p.attributes.serviceLocation === pathway); // Switch the current active playlist to the correct CDN

        if (dashMediaPlaylists.length) {
          this.mediaTypes_[type].activePlaylistLoader.media(dashMediaPlaylists[0]);
        }
      }
    });
  }
  /**
   * Start a timer that periodically calls checkABR_
   *
   * @private
   */


  startABRTimer_() {
    this.stopABRTimer_();
    this.abrTimer_ = window$1.setInterval(() => this.checkABR_(), 250);
  }
  /**
   * Stop the timer that periodically calls checkABR_
   *
   * @private
   */


  stopABRTimer_() {
    // if we're scrubbing, we don't need to pause.
    // This getter will be added to Video.js in version 7.11.
    if (this.tech_.scrubbing && this.tech_.scrubbing()) {
      return;
    }

    window$1.clearInterval(this.abrTimer_);
    this.abrTimer_ = null;
  }
  /**
   * Get a list of playlists for the currently selected audio playlist
   *
   * @return {Array} the array of audio playlists
   */


  getAudioTrackPlaylists_() {
    const main = this.main();
    const defaultPlaylists = main && main.playlists || []; // if we don't have any audio groups then we can only
    // assume that the audio tracks are contained in main
    // playlist array, use that or an empty array.

    if (!main || !main.mediaGroups || !main.mediaGroups.AUDIO) {
      return defaultPlaylists;
    }

    const AUDIO = main.mediaGroups.AUDIO;
    const groupKeys = Object.keys(AUDIO);
    let track; // get the current active track

    if (Object.keys(this.mediaTypes_.AUDIO.groups).length) {
      track = this.mediaTypes_.AUDIO.activeTrack(); // or get the default track from main if mediaTypes_ isn't setup yet
    } else {
      // default group is `main` or just the first group.
      const defaultGroup = AUDIO.main || groupKeys.length && AUDIO[groupKeys[0]];

      for (const label in defaultGroup) {
        if (defaultGroup[label].default) {
          track = {
            label
          };
          break;
        }
      }
    } // no active track no playlists.


    if (!track) {
      return defaultPlaylists;
    }

    const playlists = []; // get all of the playlists that are possible for the
    // active track.

    for (const group in AUDIO) {
      if (AUDIO[group][track.label]) {
        const properties = AUDIO[group][track.label];

        if (properties.playlists && properties.playlists.length) {
          playlists.push.apply(playlists, properties.playlists);
        } else if (properties.uri) {
          playlists.push(properties);
        } else if (main.playlists.length) {
          // if an audio group does not have a uri
          // see if we have main playlists that use it as a group.
          // if we do then add those to the playlists list.
          for (let i = 0; i < main.playlists.length; i++) {
            const playlist = main.playlists[i];

            if (playlist.attributes && playlist.attributes.AUDIO && playlist.attributes.AUDIO === group) {
              playlists.push(playlist);
            }
          }
        }
      }
    }

    if (!playlists.length) {
      return defaultPlaylists;
    }

    return playlists;
  }
  /**
   * Register event handlers on the main playlist loader. A helper
   * function for construction time.
   *
   * @private
   */


  setupMainPlaylistLoaderListeners_() {
    this.mainPlaylistLoader_.on('loadedmetadata', () => {
      const media = this.mainPlaylistLoader_.media();
      const requestTimeout = media.targetDuration * 1.5 * 1000; // If we don't have any more available playlists, we don't want to
      // timeout the request.

      if (isLowestEnabledRendition(this.mainPlaylistLoader_.main, this.mainPlaylistLoader_.media())) {
        this.requestOptions_.timeout = 0;
      } else {
        this.requestOptions_.timeout = requestTimeout;
      } // if this isn't a live video and preload permits, start
      // downloading segments


      if (media.endList && this.tech_.preload() !== 'none') {
        this.mainSegmentLoader_.playlist(media, this.requestOptions_);
        this.mainSegmentLoader_.load();
      }

      setupMediaGroups({
        sourceType: this.sourceType_,
        segmentLoaders: {
          AUDIO: this.audioSegmentLoader_,
          SUBTITLES: this.subtitleSegmentLoader_,
          main: this.mainSegmentLoader_
        },
        tech: this.tech_,
        requestOptions: this.requestOptions_,
        mainPlaylistLoader: this.mainPlaylistLoader_,
        vhs: this.vhs_,
        main: this.main(),
        mediaTypes: this.mediaTypes_,
        excludePlaylist: this.excludePlaylist.bind(this)
      });
      this.triggerPresenceUsage_(this.main(), media);
      this.setupFirstPlay();

      if (!this.mediaTypes_.AUDIO.activePlaylistLoader || this.mediaTypes_.AUDIO.activePlaylistLoader.media()) {
        this.trigger('selectedinitialmedia');
      } else {
        // We must wait for the active audio playlist loader to
        // finish setting up before triggering this event so the
        // representations API and EME setup is correct
        this.mediaTypes_.AUDIO.activePlaylistLoader.one('loadedmetadata', () => {
          this.trigger('selectedinitialmedia');
        });
      }
    });
    this.mainPlaylistLoader_.on('loadedplaylist', () => {
      if (this.loadOnPlay_) {
        this.tech_.off('play', this.loadOnPlay_);
      }

      let updatedPlaylist = this.mainPlaylistLoader_.media();

      if (!updatedPlaylist) {
        // Add content steering listeners on first load and init.
        this.attachContentSteeringListeners_();
        this.initContentSteeringController_(); // exclude any variants that are not supported by the browser before selecting
        // an initial media as the playlist selectors do not consider browser support

        this.excludeUnsupportedVariants_();
        let selectedMedia;

        if (this.enableLowInitialPlaylist) {
          selectedMedia = this.selectInitialPlaylist();
        }

        if (!selectedMedia) {
          selectedMedia = this.selectPlaylist();
        }

        if (!selectedMedia || !this.shouldSwitchToMedia_(selectedMedia)) {
          return;
        }

        this.initialMedia_ = selectedMedia;
        this.switchMedia_(this.initialMedia_, 'initial'); // Under the standard case where a source URL is provided, loadedplaylist will
        // fire again since the playlist will be requested. In the case of vhs-json
        // (where the manifest object is provided as the source), when the media
        // playlist's `segments` list is already available, a media playlist won't be
        // requested, and loadedplaylist won't fire again, so the playlist handler must be
        // called on its own here.

        const haveJsonSource = this.sourceType_ === 'vhs-json' && this.initialMedia_.segments;

        if (!haveJsonSource) {
          return;
        }

        updatedPlaylist = this.initialMedia_;
      }

      this.handleUpdatedMediaPlaylist(updatedPlaylist);
    });
    this.mainPlaylistLoader_.on('error', () => {
      const error = this.mainPlaylistLoader_.error;
      this.excludePlaylist({
        playlistToExclude: error.playlist,
        error
      });
    });
    this.mainPlaylistLoader_.on('mediachanging', () => {
      this.mainSegmentLoader_.abort();
      this.mainSegmentLoader_.pause();
    });
    this.mainPlaylistLoader_.on('mediachange', () => {
      const media = this.mainPlaylistLoader_.media();
      const requestTimeout = media.targetDuration * 1.5 * 1000; // If we don't have any more available playlists, we don't want to
      // timeout the request.

      if (isLowestEnabledRendition(this.mainPlaylistLoader_.main, this.mainPlaylistLoader_.media())) {
        this.requestOptions_.timeout = 0;
      } else {
        this.requestOptions_.timeout = requestTimeout;
      }

      if (this.sourceType_ === 'dash') {
        // we don't want to re-request the same hls playlist right after it was changed
        this.mainPlaylistLoader_.load();
      } // TODO: Create a new event on the PlaylistLoader that signals
      // that the segments have changed in some way and use that to
      // update the SegmentLoader instead of doing it twice here and
      // on `loadedplaylist`


      this.mainSegmentLoader_.pause();
      this.mainSegmentLoader_.playlist(media, this.requestOptions_);

      if (this.waitingForFastQualityPlaylistReceived_) {
        this.runFastQualitySwitch_();
      } else {
        this.mainSegmentLoader_.load();
      }

      this.tech_.trigger({
        type: 'mediachange',
        bubbles: true
      });
    });
    this.mainPlaylistLoader_.on('playlistunchanged', () => {
      const updatedPlaylist = this.mainPlaylistLoader_.media(); // ignore unchanged playlists that have already been
      // excluded for not-changing. We likely just have a really slowly updating
      // playlist.

      if (updatedPlaylist.lastExcludeReason_ === 'playlist-unchanged') {
        return;
      }

      const playlistOutdated = this.stuckAtPlaylistEnd_(updatedPlaylist);

      if (playlistOutdated) {
        // Playlist has stopped updating and we're stuck at its end. Try to
        // exclude it and switch to another playlist in the hope that that
        // one is updating (and give the player a chance to re-adjust to the
        // safe live point).
        this.excludePlaylist({
          error: {
            message: 'Playlist no longer updating.',
            reason: 'playlist-unchanged'
          }
        }); // useful for monitoring QoS

        this.tech_.trigger('playliststuck');
      }
    });
    this.mainPlaylistLoader_.on('renditiondisabled', () => {
      this.tech_.trigger({
        type: 'usage',
        name: 'vhs-rendition-disabled'
      });
    });
    this.mainPlaylistLoader_.on('renditionenabled', () => {
      this.tech_.trigger({
        type: 'usage',
        name: 'vhs-rendition-enabled'
      });
    });
  }
  /**
   * Given an updated media playlist (whether it was loaded for the first time, or
   * refreshed for live playlists), update any relevant properties and state to reflect
   * changes in the media that should be accounted for (e.g., cues and duration).
   *
   * @param {Object} updatedPlaylist the updated media playlist object
   *
   * @private
   */


  handleUpdatedMediaPlaylist(updatedPlaylist) {
    if (this.useCueTags_) {
      this.updateAdCues_(updatedPlaylist);
    } // TODO: Create a new event on the PlaylistLoader that signals
    // that the segments have changed in some way and use that to
    // update the SegmentLoader instead of doing it twice here and
    // on `mediachange`


    this.mainSegmentLoader_.pause();
    this.mainSegmentLoader_.playlist(updatedPlaylist, this.requestOptions_);

    if (this.waitingForFastQualityPlaylistReceived_) {
      this.runFastQualitySwitch_();
    }

    this.updateDuration(!updatedPlaylist.endList); // If the player isn't paused, ensure that the segment loader is running,
    // as it is possible that it was temporarily stopped while waiting for
    // a playlist (e.g., in case the playlist errored and we re-requested it).

    if (!this.tech_.paused()) {
      this.mainSegmentLoader_.load();

      if (this.audioSegmentLoader_) {
        this.audioSegmentLoader_.load();
      }
    }
  }
  /**
   * A helper function for triggerring presence usage events once per source
   *
   * @private
   */


  triggerPresenceUsage_(main, media) {
    const mediaGroups = main.mediaGroups || {};
    let defaultDemuxed = true;
    const audioGroupKeys = Object.keys(mediaGroups.AUDIO);

    for (const mediaGroup in mediaGroups.AUDIO) {
      for (const label in mediaGroups.AUDIO[mediaGroup]) {
        const properties = mediaGroups.AUDIO[mediaGroup][label];

        if (!properties.uri) {
          defaultDemuxed = false;
        }
      }
    }

    if (defaultDemuxed) {
      this.tech_.trigger({
        type: 'usage',
        name: 'vhs-demuxed'
      });
    }

    if (Object.keys(mediaGroups.SUBTITLES).length) {
      this.tech_.trigger({
        type: 'usage',
        name: 'vhs-webvtt'
      });
    }

    if (Vhs$1.Playlist.isAes(media)) {
      this.tech_.trigger({
        type: 'usage',
        name: 'vhs-aes'
      });
    }

    if (audioGroupKeys.length && Object.keys(mediaGroups.AUDIO[audioGroupKeys[0]]).length > 1) {
      this.tech_.trigger({
        type: 'usage',
        name: 'vhs-alternate-audio'
      });
    }

    if (this.useCueTags_) {
      this.tech_.trigger({
        type: 'usage',
        name: 'vhs-playlist-cue-tags'
      });
    }
  }

  shouldSwitchToMedia_(nextPlaylist) {
    const currentPlaylist = this.mainPlaylistLoader_.media() || this.mainPlaylistLoader_.pendingMedia_;
    const currentTime = this.tech_.currentTime();
    const bufferLowWaterLine = this.bufferLowWaterLine();
    const bufferHighWaterLine = this.bufferHighWaterLine();
    const buffered = this.tech_.buffered();
    return shouldSwitchToMedia({
      buffered,
      currentTime,
      currentPlaylist,
      nextPlaylist,
      bufferLowWaterLine,
      bufferHighWaterLine,
      duration: this.duration(),
      bufferBasedABR: this.bufferBasedABR,
      log: this.logger_
    });
  }
  /**
   * Register event handlers on the segment loaders. A helper function
   * for construction time.
   *
   * @private
   */


  setupSegmentLoaderListeners_() {
    this.mainSegmentLoader_.on('bandwidthupdate', () => {
      // Whether or not buffer based ABR or another ABR is used, on a bandwidth change it's
      // useful to check to see if a rendition switch should be made.
      this.checkABR_('bandwidthupdate');
      this.tech_.trigger('bandwidthupdate');
    });
    this.mainSegmentLoader_.on('timeout', () => {
      if (this.bufferBasedABR) {
        // If a rendition change is needed, then it would've be done on `bandwidthupdate`.
        // Here the only consideration is that for buffer based ABR there's no guarantee
        // of an immediate switch (since the bandwidth is averaged with a timeout
        // bandwidth value of 1), so force a load on the segment loader to keep it going.
        this.mainSegmentLoader_.load();
      }
    }); // `progress` events are not reliable enough of a bandwidth measure to trigger buffer
    // based ABR.

    if (!this.bufferBasedABR) {
      this.mainSegmentLoader_.on('progress', () => {
        this.trigger('progress');
      });
    }

    this.mainSegmentLoader_.on('error', () => {
      const error = this.mainSegmentLoader_.error();
      this.excludePlaylist({
        playlistToExclude: error.playlist,
        error
      });
    });
    this.mainSegmentLoader_.on('appenderror', () => {
      this.error = this.mainSegmentLoader_.error_;
      this.trigger('error');
    });
    this.mainSegmentLoader_.on('syncinfoupdate', () => {
      this.onSyncInfoUpdate_();
    });
    this.mainSegmentLoader_.on('timestampoffset', () => {
      this.tech_.trigger({
        type: 'usage',
        name: 'vhs-timestamp-offset'
      });
    });
    this.audioSegmentLoader_.on('syncinfoupdate', () => {
      this.onSyncInfoUpdate_();
    });
    this.audioSegmentLoader_.on('appenderror', () => {
      this.error = this.audioSegmentLoader_.error_;
      this.trigger('error');
    });
    this.mainSegmentLoader_.on('ended', () => {
      this.logger_('main segment loader ended');
      this.onEndOfStream();
    });
    this.mainSegmentLoader_.on('earlyabort', event => {
      // never try to early abort with the new ABR algorithm
      if (this.bufferBasedABR) {
        return;
      }

      this.delegateLoaders_('all', ['abort']);
      this.excludePlaylist({
        error: {
          message: 'Aborted early because there isn\'t enough bandwidth to complete ' + 'the request without rebuffering.'
        },
        playlistExclusionDuration: ABORT_EARLY_EXCLUSION_SECONDS
      });
    });

    const updateCodecs = () => {
      if (!this.sourceUpdater_.hasCreatedSourceBuffers()) {
        return this.tryToCreateSourceBuffers_();
      }

      const codecs = this.getCodecsOrExclude_(); // no codecs means that the playlist was excluded

      if (!codecs) {
        return;
      }

      this.sourceUpdater_.addOrChangeSourceBuffers(codecs);
    };

    this.mainSegmentLoader_.on('trackinfo', updateCodecs);
    this.audioSegmentLoader_.on('trackinfo', updateCodecs);
    this.mainSegmentLoader_.on('fmp4', () => {
      if (!this.triggeredFmp4Usage) {
        this.tech_.trigger({
          type: 'usage',
          name: 'vhs-fmp4'
        });
        this.triggeredFmp4Usage = true;
      }
    });
    this.audioSegmentLoader_.on('fmp4', () => {
      if (!this.triggeredFmp4Usage) {
        this.tech_.trigger({
          type: 'usage',
          name: 'vhs-fmp4'
        });
        this.triggeredFmp4Usage = true;
      }
    });
    this.audioSegmentLoader_.on('ended', () => {
      this.logger_('audioSegmentLoader ended');
      this.onEndOfStream();
    });
  }

  mediaSecondsLoaded_() {
    return Math.max(this.audioSegmentLoader_.mediaSecondsLoaded + this.mainSegmentLoader_.mediaSecondsLoaded);
  }
  /**
   * Call load on our SegmentLoaders
   */


  load() {
    this.mainSegmentLoader_.load();

    if (this.mediaTypes_.AUDIO.activePlaylistLoader) {
      this.audioSegmentLoader_.load();
    }

    if (this.mediaTypes_.SUBTITLES.activePlaylistLoader) {
      this.subtitleSegmentLoader_.load();
    }
  }
  /**
   * Re-tune playback quality level for the current player
   * conditions. This method will perform destructive actions like removing
   * already buffered content in order to readjust the currently active
   * playlist quickly. This is good for manual quality changes
   *
   * @private
   */


  fastQualityChange_(media = this.selectPlaylist()) {
    if (media && media === this.mainPlaylistLoader_.media()) {
      this.logger_('skipping fastQualityChange because new media is same as old');
      return;
    }

    this.switchMedia_(media, 'fast-quality'); // we would like to avoid race condition when we call fastQuality,
    // reset everything and start loading segments from prev segments instead of new because new playlist is not received yet

    this.waitingForFastQualityPlaylistReceived_ = true;
  }

  runFastQualitySwitch_() {
    this.waitingForFastQualityPlaylistReceived_ = false; // Delete all buffered data to allow an immediate quality switch, then seek to give
    // the browser a kick to remove any cached frames from the previous rendtion (.04 seconds
    // ahead was roughly the minimum that will accomplish this across a variety of content
    // in IE and Edge, but seeking in place is sufficient on all other browsers)
    // Edge/IE bug: https://developer.microsoft.com/en-us/microsoft-edge/platform/issues/14600375/
    // Chrome bug: https://bugs.chromium.org/p/chromium/issues/detail?id=651904

    this.mainSegmentLoader_.pause();
    this.mainSegmentLoader_.resetEverything(() => {
      this.tech_.setCurrentTime(this.tech_.currentTime());
    }); // don't need to reset audio as it is reset when media changes
  }
  /**
   * Begin playback.
   */


  play() {
    if (this.setupFirstPlay()) {
      return;
    }

    if (this.tech_.ended()) {
      this.tech_.setCurrentTime(0);
    }

    if (this.hasPlayed_) {
      this.load();
    }

    const seekable = this.tech_.seekable(); // if the viewer has paused and we fell out of the live window,
    // seek forward to the live point

    if (this.tech_.duration() === Infinity) {
      if (this.tech_.currentTime() < seekable.start(0)) {
        return this.tech_.setCurrentTime(seekable.end(seekable.length - 1));
      }
    }
  }
  /**
   * Seek to the latest media position if this is a live video and the
   * player and video are loaded and initialized.
   */


  setupFirstPlay() {
    const media = this.mainPlaylistLoader_.media(); // Check that everything is ready to begin buffering for the first call to play
    //  If 1) there is no active media
    //     2) the player is paused
    //     3) the first play has already been setup
    // then exit early

    if (!media || this.tech_.paused() || this.hasPlayed_) {
      return false;
    } // when the video is a live stream and/or has a start time


    if (!media.endList || media.start) {
      const seekable = this.seekable();

      if (!seekable.length) {
        // without a seekable range, the player cannot seek to begin buffering at the
        // live or start point
        return false;
      }

      const seekableEnd = seekable.end(0);
      let startPoint = seekableEnd;

      if (media.start) {
        const offset = media.start.timeOffset;

        if (offset < 0) {
          startPoint = Math.max(seekableEnd + offset, seekable.start(0));
        } else {
          startPoint = Math.min(seekableEnd, offset);
        }
      } // trigger firstplay to inform the source handler to ignore the next seek event


      this.trigger('firstplay'); // seek to the live point

      this.tech_.setCurrentTime(startPoint);
    }

    this.hasPlayed_ = true; // we can begin loading now that everything is ready

    this.load();
    return true;
  }
  /**
   * handle the sourceopen event on the MediaSource
   *
   * @private
   */


  handleSourceOpen_() {
    // Only attempt to create the source buffer if none already exist.
    // handleSourceOpen is also called when we are "re-opening" a source buffer
    // after `endOfStream` has been called (in response to a seek for instance)
    this.tryToCreateSourceBuffers_(); // if autoplay is enabled, begin playback. This is duplicative of
    // code in video.js but is required because play() must be invoked
    // *after* the media source has opened.

    if (this.tech_.autoplay()) {
      const playPromise = this.tech_.play(); // Catch/silence error when a pause interrupts a play request
      // on browsers which return a promise

      if (typeof playPromise !== 'undefined' && typeof playPromise.then === 'function') {
        playPromise.then(null, e => {});
      }
    }

    this.trigger('sourceopen');
  }
  /**
   * handle the sourceended event on the MediaSource
   *
   * @private
   */


  handleSourceEnded_() {
    if (!this.inbandTextTracks_.metadataTrack_) {
      return;
    }

    const cues = this.inbandTextTracks_.metadataTrack_.cues;

    if (!cues || !cues.length) {
      return;
    }

    const duration = this.duration();
    cues[cues.length - 1].endTime = isNaN(duration) || Math.abs(duration) === Infinity ? Number.MAX_VALUE : duration;
  }
  /**
   * handle the durationchange event on the MediaSource
   *
   * @private
   */


  handleDurationChange_() {
    this.tech_.trigger('durationchange');
  }
  /**
   * Calls endOfStream on the media source when all active stream types have called
   * endOfStream
   *
   * @param {string} streamType
   *        Stream type of the segment loader that called endOfStream
   * @private
   */


  onEndOfStream() {
    let isEndOfStream = this.mainSegmentLoader_.ended_;

    if (this.mediaTypes_.AUDIO.activePlaylistLoader) {
      const mainMediaInfo = this.mainSegmentLoader_.getCurrentMediaInfo_(); // if the audio playlist loader exists, then alternate audio is active

      if (!mainMediaInfo || mainMediaInfo.hasVideo) {
        // if we do not know if the main segment loader contains video yet or if we
        // definitively know the main segment loader contains video, then we need to wait
        // for both main and audio segment loaders to call endOfStream
        isEndOfStream = isEndOfStream && this.audioSegmentLoader_.ended_;
      } else {
        // otherwise just rely on the audio loader
        isEndOfStream = this.audioSegmentLoader_.ended_;
      }
    }

    if (!isEndOfStream) {
      return;
    }

    this.stopABRTimer_();
    this.sourceUpdater_.endOfStream();
  }
  /**
   * Check if a playlist has stopped being updated
   *
   * @param {Object} playlist the media playlist object
   * @return {boolean} whether the playlist has stopped being updated or not
   */


  stuckAtPlaylistEnd_(playlist) {
    const seekable = this.seekable();

    if (!seekable.length) {
      // playlist doesn't have enough information to determine whether we are stuck
      return false;
    }

    const expired = this.syncController_.getExpiredTime(playlist, this.duration());

    if (expired === null) {
      return false;
    } // does not use the safe live end to calculate playlist end, since we
    // don't want to say we are stuck while there is still content


    const absolutePlaylistEnd = Vhs$1.Playlist.playlistEnd(playlist, expired);
    const currentTime = this.tech_.currentTime();
    const buffered = this.tech_.buffered();

    if (!buffered.length) {
      // return true if the playhead reached the absolute end of the playlist
      return absolutePlaylistEnd - currentTime <= SAFE_TIME_DELTA;
    }

    const bufferedEnd = buffered.end(buffered.length - 1); // return true if there is too little buffer left and buffer has reached absolute
    // end of playlist

    return bufferedEnd - currentTime <= SAFE_TIME_DELTA && absolutePlaylistEnd - bufferedEnd <= SAFE_TIME_DELTA;
  }
  /**
   * Exclude a playlist for a set amount of time, making it unavailable for selection by
   * the rendition selection algorithm, then force a new playlist (rendition) selection.
   *
   * @param {Object=} playlistToExclude
   *                  the playlist to exclude, defaults to the currently selected playlist
   * @param {Object=} error
   *                  an optional error
   * @param {number=} playlistExclusionDuration
   *                  an optional number of seconds to exclude the playlist
   */


  excludePlaylist({
    playlistToExclude = this.mainPlaylistLoader_.media(),
    error = {},
    playlistExclusionDuration
  }) {
    // If the `error` was generated by the playlist loader, it will contain
    // the playlist we were trying to load (but failed) and that should be
    // excluded instead of the currently selected playlist which is likely
    // out-of-date in this scenario
    playlistToExclude = playlistToExclude || this.mainPlaylistLoader_.media();
    playlistExclusionDuration = playlistExclusionDuration || error.playlistExclusionDuration || this.playlistExclusionDuration; // If there is no current playlist, then an error occurred while we were
    // trying to load the main OR while we were disposing of the tech

    if (!playlistToExclude) {
      this.error = error;

      if (this.mediaSource.readyState !== 'open') {
        this.trigger('error');
      } else {
        this.sourceUpdater_.endOfStream('network');
      }

      return;
    }

    playlistToExclude.playlistErrors_++;
    const playlists = this.mainPlaylistLoader_.main.playlists;
    const enabledPlaylists = playlists.filter(isEnabled);
    const isFinalRendition = enabledPlaylists.length === 1 && enabledPlaylists[0] === playlistToExclude; // Don't exclude the only playlist unless it was excluded
    // forever

    if (playlists.length === 1 && playlistExclusionDuration !== Infinity) {
      videojs.log.warn(`Problem encountered with playlist ${playlistToExclude.id}. ` + 'Trying again since it is the only playlist.');
      this.tech_.trigger('retryplaylist'); // if this is a final rendition, we should delay

      return this.mainPlaylistLoader_.load(isFinalRendition);
    }

    if (isFinalRendition) {
      // If we're content steering, try other pathways.
      if (this.main().contentSteering) {
        const pathway = this.pathwayAttribute_(playlistToExclude); // Ignore at least 1 steering manifest refresh.

        const reIncludeDelay = this.contentSteeringController_.steeringManifest.ttl * 1000;
        this.contentSteeringController_.excludePathway(pathway);
        this.excludeThenChangePathway_();
        setTimeout(() => {
          this.contentSteeringController_.addAvailablePathway(pathway);
        }, reIncludeDelay);
        return;
      } // Since we're on the final non-excluded playlist, and we're about to exclude
      // it, instead of erring the player or retrying this playlist, clear out the current
      // exclusion list. This allows other playlists to be attempted in case any have been
      // fixed.


      let reincluded = false;
      playlists.forEach(playlist => {
        // skip current playlist which is about to be excluded
        if (playlist === playlistToExclude) {
          return;
        }

        const excludeUntil = playlist.excludeUntil; // a playlist cannot be reincluded if it wasn't excluded to begin with.

        if (typeof excludeUntil !== 'undefined' && excludeUntil !== Infinity) {
          reincluded = true;
          delete playlist.excludeUntil;
        }
      });

      if (reincluded) {
        videojs.log.warn('Removing other playlists from the exclusion list because the last ' + 'rendition is about to be excluded.'); // Technically we are retrying a playlist, in that we are simply retrying a previous
        // playlist. This is needed for users relying on the retryplaylist event to catch a
        // case where the player might be stuck and looping through "dead" playlists.

        this.tech_.trigger('retryplaylist');
      }
    } // Exclude this playlist


    let excludeUntil;

    if (playlistToExclude.playlistErrors_ > this.maxPlaylistRetries) {
      excludeUntil = Infinity;
    } else {
      excludeUntil = Date.now() + playlistExclusionDuration * 1000;
    }

    playlistToExclude.excludeUntil = excludeUntil;

    if (error.reason) {
      playlistToExclude.lastExcludeReason_ = error.reason;
    }

    this.tech_.trigger('excludeplaylist');
    this.tech_.trigger({
      type: 'usage',
      name: 'vhs-rendition-excluded'
    }); // TODO: only load a new playlist if we're excluding the current playlist
    // If this function was called with a playlist that's not the current active playlist
    // (e.g., media().id !== playlistToExclude.id),
    // then a new playlist should not be selected and loaded, as there's nothing wrong with the current playlist.

    const nextPlaylist = this.selectPlaylist();

    if (!nextPlaylist) {
      this.error = 'Playback cannot continue. No available working or supported playlists.';
      this.trigger('error');
      return;
    }

    const logFn = error.internal ? this.logger_ : videojs.log.warn;
    const errorMessage = error.message ? ' ' + error.message : '';
    logFn(`${error.internal ? 'Internal problem' : 'Problem'} encountered with playlist ${playlistToExclude.id}.` + `${errorMessage} Switching to playlist ${nextPlaylist.id}.`); // if audio group changed reset audio loaders

    if (nextPlaylist.attributes.AUDIO !== playlistToExclude.attributes.AUDIO) {
      this.delegateLoaders_('audio', ['abort', 'pause']);
    } // if subtitle group changed reset subtitle loaders


    if (nextPlaylist.attributes.SUBTITLES !== playlistToExclude.attributes.SUBTITLES) {
      this.delegateLoaders_('subtitle', ['abort', 'pause']);
    }

    this.delegateLoaders_('main', ['abort', 'pause']);
    const delayDuration = nextPlaylist.targetDuration / 2 * 1000 || 5 * 1000;
    const shouldDelay = typeof nextPlaylist.lastRequest === 'number' && Date.now() - nextPlaylist.lastRequest <= delayDuration; // delay if it's a final rendition or if the last refresh is sooner than half targetDuration

    return this.switchMedia_(nextPlaylist, 'exclude', isFinalRendition || shouldDelay);
  }
  /**
   * Pause all segment/playlist loaders
   */


  pauseLoading() {
    this.delegateLoaders_('all', ['abort', 'pause']);
    this.stopABRTimer_();
  }
  /**
   * Call a set of functions in order on playlist loaders, segment loaders,
   * or both types of loaders.
   *
   * @param {string} filter
   *        Filter loaders that should call fnNames using a string. Can be:
   *        * all - run on all loaders
   *        * audio - run on all audio loaders
   *        * subtitle - run on all subtitle loaders
   *        * main - run on the main loaders
   *
   * @param {Array|string} fnNames
   *        A string or array of function names to call.
   */


  delegateLoaders_(filter, fnNames) {
    const loaders = [];
    const dontFilterPlaylist = filter === 'all';

    if (dontFilterPlaylist || filter === 'main') {
      loaders.push(this.mainPlaylistLoader_);
    }

    const mediaTypes = [];

    if (dontFilterPlaylist || filter === 'audio') {
      mediaTypes.push('AUDIO');
    }

    if (dontFilterPlaylist || filter === 'subtitle') {
      mediaTypes.push('CLOSED-CAPTIONS');
      mediaTypes.push('SUBTITLES');
    }

    mediaTypes.forEach(mediaType => {
      const loader = this.mediaTypes_[mediaType] && this.mediaTypes_[mediaType].activePlaylistLoader;

      if (loader) {
        loaders.push(loader);
      }
    });
    ['main', 'audio', 'subtitle'].forEach(name => {
      const loader = this[`${name}SegmentLoader_`];

      if (loader && (filter === name || filter === 'all')) {
        loaders.push(loader);
      }
    });
    loaders.forEach(loader => fnNames.forEach(fnName => {
      if (typeof loader[fnName] === 'function') {
        loader[fnName]();
      }
    }));
  }
  /**
   * set the current time on all segment loaders
   *
   * @param {TimeRange} currentTime the current time to set
   * @return {TimeRange} the current time
   */


  setCurrentTime(currentTime) {
    const buffered = findRange(this.tech_.buffered(), currentTime);

    if (!(this.mainPlaylistLoader_ && this.mainPlaylistLoader_.media())) {
      // return immediately if the metadata is not ready yet
      return 0;
    } // it's clearly an edge-case but don't thrown an error if asked to
    // seek within an empty playlist


    if (!this.mainPlaylistLoader_.media().segments) {
      return 0;
    } // if the seek location is already buffered, continue buffering as usual


    if (buffered && buffered.length) {
      return currentTime;
    } // cancel outstanding requests so we begin buffering at the new
    // location


    this.mainSegmentLoader_.pause();
    this.mainSegmentLoader_.resetEverything();

    if (this.mediaTypes_.AUDIO.activePlaylistLoader) {
      this.audioSegmentLoader_.pause();
      this.audioSegmentLoader_.resetEverything();
    }

    if (this.mediaTypes_.SUBTITLES.activePlaylistLoader) {
      this.subtitleSegmentLoader_.pause();
      this.subtitleSegmentLoader_.resetEverything();
    } // start segment loader loading in case they are paused


    this.load();
  }
  /**
   * get the current duration
   *
   * @return {TimeRange} the duration
   */


  duration() {
    if (!this.mainPlaylistLoader_) {
      return 0;
    }

    const media = this.mainPlaylistLoader_.media();

    if (!media) {
      // no playlists loaded yet, so can't determine a duration
      return 0;
    } // Don't rely on the media source for duration in the case of a live playlist since
    // setting the native MediaSource's duration to infinity ends up with consequences to
    // seekable behavior. See https://github.com/w3c/media-source/issues/5 for details.
    //
    // This is resolved in the spec by https://github.com/w3c/media-source/pull/92,
    // however, few browsers have support for setLiveSeekableRange()
    // https://developer.mozilla.org/en-US/docs/Web/API/MediaSource/setLiveSeekableRange
    //
    // Until a time when the duration of the media source can be set to infinity, and a
    // seekable range specified across browsers, just return Infinity.


    if (!media.endList) {
      return Infinity;
    } // Since this is a VOD video, it is safe to rely on the media source's duration (if
    // available). If it's not available, fall back to a playlist-calculated estimate.


    if (this.mediaSource) {
      return this.mediaSource.duration;
    }

    return Vhs$1.Playlist.duration(media);
  }
  /**
   * check the seekable range
   *
   * @return {TimeRange} the seekable range
   */


  seekable() {
    return this.seekable_;
  }

  onSyncInfoUpdate_() {
    let audioSeekable; // TODO check for creation of both source buffers before updating seekable
    //
    // A fix was made to this function where a check for
    // this.sourceUpdater_.hasCreatedSourceBuffers
    // was added to ensure that both source buffers were created before seekable was
    // updated. However, it originally had a bug where it was checking for a true and
    // returning early instead of checking for false. Setting it to check for false to
    // return early though created other issues. A call to play() would check for seekable
    // end without verifying that a seekable range was present. In addition, even checking
    // for that didn't solve some issues, as handleFirstPlay is sometimes worked around
    // due to a media update calling load on the segment loaders, skipping a seek to live,
    // thereby starting live streams at the beginning of the stream rather than at the end.
    //
    // This conditional should be fixed to wait for the creation of two source buffers at
    // the same time as the other sections of code are fixed to properly seek to live and
    // not throw an error due to checking for a seekable end when no seekable range exists.
    //
    // For now, fall back to the older behavior, with the understanding that the seekable
    // range may not be completely correct, leading to a suboptimal initial live point.

    if (!this.mainPlaylistLoader_) {
      return;
    }

    let media = this.mainPlaylistLoader_.media();

    if (!media) {
      return;
    }

    let expired = this.syncController_.getExpiredTime(media, this.duration());

    if (expired === null) {
      // not enough information to update seekable
      return;
    }

    const main = this.mainPlaylistLoader_.main;
    const mainSeekable = Vhs$1.Playlist.seekable(media, expired, Vhs$1.Playlist.liveEdgeDelay(main, media));

    if (mainSeekable.length === 0) {
      return;
    }

    if (this.mediaTypes_.AUDIO.activePlaylistLoader) {
      media = this.mediaTypes_.AUDIO.activePlaylistLoader.media();
      expired = this.syncController_.getExpiredTime(media, this.duration());

      if (expired === null) {
        return;
      }

      audioSeekable = Vhs$1.Playlist.seekable(media, expired, Vhs$1.Playlist.liveEdgeDelay(main, media));

      if (audioSeekable.length === 0) {
        return;
      }
    }

    let oldEnd;
    let oldStart;

    if (this.seekable_ && this.seekable_.length) {
      oldEnd = this.seekable_.end(0);
      oldStart = this.seekable_.start(0);
    }

    if (!audioSeekable) {
      // seekable has been calculated based on buffering video data so it
      // can be returned directly
      this.seekable_ = mainSeekable;
    } else if (audioSeekable.start(0) > mainSeekable.end(0) || mainSeekable.start(0) > audioSeekable.end(0)) {
      // seekables are pretty far off, rely on main
      this.seekable_ = mainSeekable;
    } else {
      this.seekable_ = createTimeRanges([[audioSeekable.start(0) > mainSeekable.start(0) ? audioSeekable.start(0) : mainSeekable.start(0), audioSeekable.end(0) < mainSeekable.end(0) ? audioSeekable.end(0) : mainSeekable.end(0)]]);
    } // seekable is the same as last time


    if (this.seekable_ && this.seekable_.length) {
      if (this.seekable_.end(0) === oldEnd && this.seekable_.start(0) === oldStart) {
        return;
      }
    }

    this.logger_(`seekable updated [${printableRange(this.seekable_)}]`);
    this.tech_.trigger('seekablechanged');
  }
  /**
   * Update the player duration
   */


  updateDuration(isLive) {
    if (this.updateDuration_) {
      this.mediaSource.removeEventListener('sourceopen', this.updateDuration_);
      this.updateDuration_ = null;
    }

    if (this.mediaSource.readyState !== 'open') {
      this.updateDuration_ = this.updateDuration.bind(this, isLive);
      this.mediaSource.addEventListener('sourceopen', this.updateDuration_);
      return;
    }

    if (isLive) {
      const seekable = this.seekable();

      if (!seekable.length) {
        return;
      } // Even in the case of a live playlist, the native MediaSource's duration should not
      // be set to Infinity (even though this would be expected for a live playlist), since
      // setting the native MediaSource's duration to infinity ends up with consequences to
      // seekable behavior. See https://github.com/w3c/media-source/issues/5 for details.
      //
      // This is resolved in the spec by https://github.com/w3c/media-source/pull/92,
      // however, few browsers have support for setLiveSeekableRange()
      // https://developer.mozilla.org/en-US/docs/Web/API/MediaSource/setLiveSeekableRange
      //
      // Until a time when the duration of the media source can be set to infinity, and a
      // seekable range specified across browsers, the duration should be greater than or
      // equal to the last possible seekable value.
      // MediaSource duration starts as NaN
      // It is possible (and probable) that this case will never be reached for many
      // sources, since the MediaSource reports duration as the highest value without
      // accounting for timestamp offset. For example, if the timestamp offset is -100 and
      // we buffered times 0 to 100 with real times of 100 to 200, even though current
      // time will be between 0 and 100, the native media source may report the duration
      // as 200. However, since we report duration separate from the media source (as
      // Infinity), and as long as the native media source duration value is greater than
      // our reported seekable range, seeks will work as expected. The large number as
      // duration for live is actually a strategy used by some players to work around the
      // issue of live seekable ranges cited above.


      if (isNaN(this.mediaSource.duration) || this.mediaSource.duration < seekable.end(seekable.length - 1)) {
        this.sourceUpdater_.setDuration(seekable.end(seekable.length - 1));
      }

      return;
    }

    const buffered = this.tech_.buffered();
    let duration = Vhs$1.Playlist.duration(this.mainPlaylistLoader_.media());

    if (buffered.length > 0) {
      duration = Math.max(duration, buffered.end(buffered.length - 1));
    }

    if (this.mediaSource.duration !== duration) {
      this.sourceUpdater_.setDuration(duration);
    }
  }
  /**
   * dispose of the PlaylistController and everything
   * that it controls
   */


  dispose() {
    this.trigger('dispose');
    this.decrypter_.terminate();
    this.mainPlaylistLoader_.dispose();
    this.mainSegmentLoader_.dispose();
    this.contentSteeringController_.dispose();
    this.keyStatusMap_.clear();

    if (this.loadOnPlay_) {
      this.tech_.off('play', this.loadOnPlay_);
    }

    ['AUDIO', 'SUBTITLES'].forEach(type => {
      const groups = this.mediaTypes_[type].groups;

      for (const id in groups) {
        groups[id].forEach(group => {
          if (group.playlistLoader) {
            group.playlistLoader.dispose();
          }
        });
      }
    });
    this.audioSegmentLoader_.dispose();
    this.subtitleSegmentLoader_.dispose();
    this.sourceUpdater_.dispose();
    this.timelineChangeController_.dispose();
    this.stopABRTimer_();

    if (this.updateDuration_) {
      this.mediaSource.removeEventListener('sourceopen', this.updateDuration_);
    }

    this.mediaSource.removeEventListener('durationchange', this.handleDurationChange_); // load the media source into the player

    this.mediaSource.removeEventListener('sourceopen', this.handleSourceOpen_);
    this.mediaSource.removeEventListener('sourceended', this.handleSourceEnded_);
    this.off();
  }
  /**
   * return the main playlist object if we have one
   *
   * @return {Object} the main playlist object that we parsed
   */


  main() {
    return this.mainPlaylistLoader_.main;
  }
  /**
   * return the currently selected playlist
   *
   * @return {Object} the currently selected playlist object that we parsed
   */


  media() {
    // playlist loader will not return media if it has not been fully loaded
    return this.mainPlaylistLoader_.media() || this.initialMedia_;
  }

  areMediaTypesKnown_() {
    const usingAudioLoader = !!this.mediaTypes_.AUDIO.activePlaylistLoader;
    const hasMainMediaInfo = !!this.mainSegmentLoader_.getCurrentMediaInfo_(); // if we are not using an audio loader, then we have audio media info
    // otherwise check on the segment loader.

    const hasAudioMediaInfo = !usingAudioLoader ? true : !!this.audioSegmentLoader_.getCurrentMediaInfo_(); // one or both loaders has not loaded sufficently to get codecs

    if (!hasMainMediaInfo || !hasAudioMediaInfo) {
      return false;
    }

    return true;
  }

  getCodecsOrExclude_() {
    const media = {
      main: this.mainSegmentLoader_.getCurrentMediaInfo_() || {},
      audio: this.audioSegmentLoader_.getCurrentMediaInfo_() || {}
    };
    const playlist = this.mainSegmentLoader_.getPendingSegmentPlaylist() || this.media(); // set "main" media equal to video

    media.video = media.main;
    const playlistCodecs = codecsForPlaylist(this.main(), playlist);
    const codecs = {};
    const usingAudioLoader = !!this.mediaTypes_.AUDIO.activePlaylistLoader;

    if (media.main.hasVideo) {
      codecs.video = playlistCodecs.video || media.main.videoCodec || DEFAULT_VIDEO_CODEC;
    }

    if (media.main.isMuxed) {
      codecs.video += `,${playlistCodecs.audio || media.main.audioCodec || DEFAULT_AUDIO_CODEC}`;
    }

    if (media.main.hasAudio && !media.main.isMuxed || media.audio.hasAudio || usingAudioLoader) {
      codecs.audio = playlistCodecs.audio || media.main.audioCodec || media.audio.audioCodec || DEFAULT_AUDIO_CODEC; // set audio isFmp4 so we use the correct "supports" function below

      media.audio.isFmp4 = media.main.hasAudio && !media.main.isMuxed ? media.main.isFmp4 : media.audio.isFmp4;
    } // no codecs, no playback.


    if (!codecs.audio && !codecs.video) {
      this.excludePlaylist({
        playlistToExclude: playlist,
        error: {
          message: 'Could not determine codecs for playlist.'
        },
        playlistExclusionDuration: Infinity
      });
      return;
    } // fmp4 relies on browser support, while ts relies on muxer support


    const supportFunction = (isFmp4, codec) => isFmp4 ? browserSupportsCodec(codec) : muxerSupportsCodec(codec);

    const unsupportedCodecs = {};
    let unsupportedAudio;
    ['video', 'audio'].forEach(function (type) {
      if (codecs.hasOwnProperty(type) && !supportFunction(media[type].isFmp4, codecs[type])) {
        const supporter = media[type].isFmp4 ? 'browser' : 'muxer';
        unsupportedCodecs[supporter] = unsupportedCodecs[supporter] || [];
        unsupportedCodecs[supporter].push(codecs[type]);

        if (type === 'audio') {
          unsupportedAudio = supporter;
        }
      }
    });

    if (usingAudioLoader && unsupportedAudio && playlist.attributes.AUDIO) {
      const audioGroup = playlist.attributes.AUDIO;
      this.main().playlists.forEach(variant => {
        const variantAudioGroup = variant.attributes && variant.attributes.AUDIO;

        if (variantAudioGroup === audioGroup && variant !== playlist) {
          variant.excludeUntil = Infinity;
        }
      });
      this.logger_(`excluding audio group ${audioGroup} as ${unsupportedAudio} does not support codec(s): "${codecs.audio}"`);
    } // if we have any unsupported codecs exclude this playlist.


    if (Object.keys(unsupportedCodecs).length) {
      const message = Object.keys(unsupportedCodecs).reduce((acc, supporter) => {
        if (acc) {
          acc += ', ';
        }

        acc += `${supporter} does not support codec(s): "${unsupportedCodecs[supporter].join(',')}"`;
        return acc;
      }, '') + '.';
      this.excludePlaylist({
        playlistToExclude: playlist,
        error: {
          internal: true,
          message
        },
        playlistExclusionDuration: Infinity
      });
      return;
    } // check if codec switching is happening


    if (this.sourceUpdater_.hasCreatedSourceBuffers() && !this.sourceUpdater_.canChangeType()) {
      const switchMessages = [];
      ['video', 'audio'].forEach(type => {
        const newCodec = (parseCodecs(this.sourceUpdater_.codecs[type] || '')[0] || {}).type;
        const oldCodec = (parseCodecs(codecs[type] || '')[0] || {}).type;

        if (newCodec && oldCodec && newCodec.toLowerCase() !== oldCodec.toLowerCase()) {
          switchMessages.push(`"${this.sourceUpdater_.codecs[type]}" -> "${codecs[type]}"`);
        }
      });

      if (switchMessages.length) {
        this.excludePlaylist({
          playlistToExclude: playlist,
          error: {
            message: `Codec switching not supported: ${switchMessages.join(', ')}.`,
            internal: true
          },
          playlistExclusionDuration: Infinity
        });
        return;
      }
    } // TODO: when using the muxer shouldn't we just return
    // the codecs that the muxer outputs?


    return codecs;
  }
  /**
   * Create source buffers and exlude any incompatible renditions.
   *
   * @private
   */


  tryToCreateSourceBuffers_() {
    // media source is not ready yet or sourceBuffers are already
    // created.
    if (this.mediaSource.readyState !== 'open' || this.sourceUpdater_.hasCreatedSourceBuffers()) {
      return;
    }

    if (!this.areMediaTypesKnown_()) {
      return;
    }

    const codecs = this.getCodecsOrExclude_(); // no codecs means that the playlist was excluded

    if (!codecs) {
      return;
    }

    this.sourceUpdater_.createSourceBuffers(codecs);
    const codecString = [codecs.video, codecs.audio].filter(Boolean).join(',');
    this.excludeIncompatibleVariants_(codecString);
  }
  /**
   * Excludes playlists with codecs that are unsupported by the muxer and browser.
   */


  excludeUnsupportedVariants_() {
    const playlists = this.main().playlists;
    const ids = []; // TODO: why don't we have a property to loop through all
    // playlist? Why did we ever mix indexes and keys?

    Object.keys(playlists).forEach(key => {
      const variant = playlists[key]; // check if we already processed this playlist.

      if (ids.indexOf(variant.id) !== -1) {
        return;
      }

      ids.push(variant.id);
      const codecs = codecsForPlaylist(this.main, variant);
      const unsupported = [];

      if (codecs.audio && !muxerSupportsCodec(codecs.audio) && !browserSupportsCodec(codecs.audio)) {
        unsupported.push(`audio codec ${codecs.audio}`);
      }

      if (codecs.video && !muxerSupportsCodec(codecs.video) && !browserSupportsCodec(codecs.video)) {
        unsupported.push(`video codec ${codecs.video}`);
      }

      if (codecs.text && codecs.text === 'stpp.ttml.im1t') {
        unsupported.push(`text codec ${codecs.text}`);
      }

      if (unsupported.length) {
        variant.excludeUntil = Infinity;
        this.logger_(`excluding ${variant.id} for unsupported: ${unsupported.join(', ')}`);
      }
    });
  }
  /**
   * Exclude playlists that are known to be codec or
   * stream-incompatible with the SourceBuffer configuration. For
   * instance, Media Source Extensions would cause the video element to
   * stall waiting for video data if you switched from a variant with
   * video and audio to an audio-only one.
   *
   * @param {Object} media a media playlist compatible with the current
   * set of SourceBuffers. Variants in the current main playlist that
   * do not appear to have compatible codec or stream configurations
   * will be excluded from the default playlist selection algorithm
   * indefinitely.
   * @private
   */


  excludeIncompatibleVariants_(codecString) {
    const ids = [];
    const playlists = this.main().playlists;
    const codecs = unwrapCodecList(parseCodecs(codecString));
    const codecCount_ = codecCount(codecs);
    const videoDetails = codecs.video && parseCodecs(codecs.video)[0] || null;
    const audioDetails = codecs.audio && parseCodecs(codecs.audio)[0] || null;
    Object.keys(playlists).forEach(key => {
      const variant = playlists[key]; // check if we already processed this playlist.
      // or it if it is already excluded forever.

      if (ids.indexOf(variant.id) !== -1 || variant.excludeUntil === Infinity) {
        return;
      }

      ids.push(variant.id);
      const exclusionReasons = []; // get codecs from the playlist for this variant

      const variantCodecs = codecsForPlaylist(this.mainPlaylistLoader_.main, variant);
      const variantCodecCount = codecCount(variantCodecs); // if no codecs are listed, we cannot determine that this
      // variant is incompatible. Wait for mux.js to probe

      if (!variantCodecs.audio && !variantCodecs.video) {
        return;
      } // TODO: we can support this by removing the
      // old media source and creating a new one, but it will take some work.
      // The number of streams cannot change


      if (variantCodecCount !== codecCount_) {
        exclusionReasons.push(`codec count "${variantCodecCount}" !== "${codecCount_}"`);
      } // only exclude playlists by codec change, if codecs cannot switch
      // during playback.


      if (!this.sourceUpdater_.canChangeType()) {
        const variantVideoDetails = variantCodecs.video && parseCodecs(variantCodecs.video)[0] || null;
        const variantAudioDetails = variantCodecs.audio && parseCodecs(variantCodecs.audio)[0] || null; // the video codec cannot change

        if (variantVideoDetails && videoDetails && variantVideoDetails.type.toLowerCase() !== videoDetails.type.toLowerCase()) {
          exclusionReasons.push(`video codec "${variantVideoDetails.type}" !== "${videoDetails.type}"`);
        } // the audio codec cannot change


        if (variantAudioDetails && audioDetails && variantAudioDetails.type.toLowerCase() !== audioDetails.type.toLowerCase()) {
          exclusionReasons.push(`audio codec "${variantAudioDetails.type}" !== "${audioDetails.type}"`);
        }
      }

      if (exclusionReasons.length) {
        variant.excludeUntil = Infinity;
        this.logger_(`excluding ${variant.id}: ${exclusionReasons.join(' && ')}`);
      }
    });
  }

  updateAdCues_(media) {
    let offset = 0;
    const seekable = this.seekable();

    if (seekable.length) {
      offset = seekable.start(0);
    }

    updateAdCues(media, this.cueTagsTrack_, offset);
  }
  /**
   * Calculates the desired forward buffer length based on current time
   *
   * @return {number} Desired forward buffer length in seconds
   */


  goalBufferLength() {
    const currentTime = this.tech_.currentTime();
    const initial = Config.GOAL_BUFFER_LENGTH;
    const rate = Config.GOAL_BUFFER_LENGTH_RATE;
    const max = Math.max(initial, Config.MAX_GOAL_BUFFER_LENGTH);
    return Math.min(initial + currentTime * rate, max);
  }
  /**
   * Calculates the desired buffer low water line based on current time
   *
   * @return {number} Desired buffer low water line in seconds
   */


  bufferLowWaterLine() {
    const currentTime = this.tech_.currentTime();
    const initial = Config.BUFFER_LOW_WATER_LINE;
    const rate = Config.BUFFER_LOW_WATER_LINE_RATE;
    const max = Math.max(initial, Config.MAX_BUFFER_LOW_WATER_LINE);
    const newMax = Math.max(initial, Config.EXPERIMENTAL_MAX_BUFFER_LOW_WATER_LINE);
    return Math.min(initial + currentTime * rate, this.bufferBasedABR ? newMax : max);
  }

  bufferHighWaterLine() {
    return Config.BUFFER_HIGH_WATER_LINE;
  }

  addDateRangesToTextTrack_(dateRanges) {
    createMetadataTrackIfNotExists(this.inbandTextTracks_, 'com.apple.streaming', this.tech_);
    addDateRangeMetadata({
      inbandTextTracks: this.inbandTextTracks_,
      dateRanges
    });
  }

  addMetadataToTextTrack(dispatchType, metadataArray, videoDuration) {
    const timestampOffset = this.sourceUpdater_.videoBuffer ? this.sourceUpdater_.videoTimestampOffset() : this.sourceUpdater_.audioTimestampOffset(); // There's potentially an issue where we could double add metadata if there's a muxed
    // audio/video source with a metadata track, and an alt audio with a metadata track.
    // However, this probably won't happen, and if it does it can be handled then.

    createMetadataTrackIfNotExists(this.inbandTextTracks_, dispatchType, this.tech_);
    addMetadata({
      inbandTextTracks: this.inbandTextTracks_,
      metadataArray,
      timestampOffset,
      videoDuration
    });
  }
  /**
   * Utility for getting the pathway or service location from an HLS or DASH playlist.
   *
   * @param {Object} playlist for getting pathway from.
   * @return the pathway attribute of a playlist
   */


  pathwayAttribute_(playlist) {
    return playlist.attributes['PATHWAY-ID'] || playlist.attributes.serviceLocation;
  }
  /**
   * Initialize available pathways and apply the tag properties.
   */


  initContentSteeringController_() {
    const main = this.main();

    if (!main.contentSteering) {
      return;
    }

    for (const playlist of main.playlists) {
      this.contentSteeringController_.addAvailablePathway(this.pathwayAttribute_(playlist));
    }

    this.contentSteeringController_.assignTagProperties(main.uri, main.contentSteering); // request the steering manifest immediately if queryBeforeStart is set.

    if (this.contentSteeringController_.queryBeforeStart) {
      // When queryBeforeStart is true, initial request should omit steering parameters.
      this.contentSteeringController_.requestSteeringManifest(true);
      return;
    } // otherwise start content steering after playback starts


    this.tech_.one('canplay', () => {
      this.contentSteeringController_.requestSteeringManifest();
    });
  }
  /**
   * Reset the content steering controller and re-init.
   */


  resetContentSteeringController_() {
    this.contentSteeringController_.clearAvailablePathways();
    this.contentSteeringController_.dispose();
    this.initContentSteeringController_();
  }
  /**
   * Attaches the listeners for content steering.
   */


  attachContentSteeringListeners_() {
    this.contentSteeringController_.on('content-steering', this.excludeThenChangePathway_.bind(this));

    if (this.sourceType_ === 'dash') {
      this.mainPlaylistLoader_.on('loadedplaylist', () => {
        const main = this.main(); // check if steering tag or pathways changed.

        const didDashTagChange = this.contentSteeringController_.didDASHTagChange(main.uri, main.contentSteering);

        const didPathwaysChange = () => {
          const availablePathways = this.contentSteeringController_.getAvailablePathways();
          const newPathways = [];

          for (const playlist of main.playlists) {
            const serviceLocation = playlist.attributes.serviceLocation;

            if (serviceLocation) {
              newPathways.push(serviceLocation);

              if (!availablePathways.has(serviceLocation)) {
                return true;
              }
            }
          } // If we have no new serviceLocations and previously had availablePathways


          if (!newPathways.length && availablePathways.size) {
            return true;
          }

          return false;
        };

        if (didDashTagChange || didPathwaysChange()) {
          this.resetContentSteeringController_();
        }
      });
    }
  }
  /**
   * Simple exclude and change playlist logic for content steering.
   */


  excludeThenChangePathway_() {
    const currentPathway = this.contentSteeringController_.getPathway();

    if (!currentPathway) {
      return;
    }

    this.handlePathwayClones_();
    const main = this.main();
    const playlists = main.playlists;
    const ids = new Set();
    let didEnablePlaylists = false;
    Object.keys(playlists).forEach(key => {
      const variant = playlists[key];
      const pathwayId = this.pathwayAttribute_(variant);
      const differentPathwayId = pathwayId && currentPathway !== pathwayId;
      const steeringExclusion = variant.excludeUntil === Infinity && variant.lastExcludeReason_ === 'content-steering';

      if (steeringExclusion && !differentPathwayId) {
        delete variant.excludeUntil;
        delete variant.lastExcludeReason_;
        didEnablePlaylists = true;
      }

      const noExcludeUntil = !variant.excludeUntil && variant.excludeUntil !== Infinity;
      const shouldExclude = !ids.has(variant.id) && differentPathwayId && noExcludeUntil;

      if (!shouldExclude) {
        return;
      }

      ids.add(variant.id);
      variant.excludeUntil = Infinity;
      variant.lastExcludeReason_ = 'content-steering'; // TODO: kind of spammy, maybe move this.

      this.logger_(`excluding ${variant.id} for ${variant.lastExcludeReason_}`);
    });

    if (this.contentSteeringController_.manifestType_ === 'DASH') {
      Object.keys(this.mediaTypes_).forEach(key => {
        const type = this.mediaTypes_[key];

        if (type.activePlaylistLoader) {
          const currentPlaylist = type.activePlaylistLoader.media_; // Check if the current media playlist matches the current CDN

          if (currentPlaylist && currentPlaylist.attributes.serviceLocation !== currentPathway) {
            didEnablePlaylists = true;
          }
        }
      });
    }

    if (didEnablePlaylists) {
      this.changeSegmentPathway_();
    }
  }
  /**
   * Add, update, or delete playlists and media groups for
   * the pathway clones for HLS Content Steering.
   *
   * See https://datatracker.ietf.org/doc/draft-pantos-hls-rfc8216bis/
   *
   * NOTE: Pathway cloning does not currently support the `PER_VARIANT_URIS` and
   * `PER_RENDITION_URIS` as we do not handle `STABLE-VARIANT-ID` or
   * `STABLE-RENDITION-ID` values.
   */


  handlePathwayClones_() {
    const main = this.main();
    const playlists = main.playlists;
    const currentPathwayClones = this.contentSteeringController_.currentPathwayClones;
    const nextPathwayClones = this.contentSteeringController_.nextPathwayClones;
    const hasClones = currentPathwayClones && currentPathwayClones.size || nextPathwayClones && nextPathwayClones.size;

    if (!hasClones) {
      return;
    }

    for (const [id, clone] of currentPathwayClones.entries()) {
      const newClone = nextPathwayClones.get(id); // Delete the old pathway clone.

      if (!newClone) {
        this.mainPlaylistLoader_.updateOrDeleteClone(clone);
        this.contentSteeringController_.excludePathway(id);
      }
    }

    for (const [id, clone] of nextPathwayClones.entries()) {
      const oldClone = currentPathwayClones.get(id); // Create a new pathway if it is a new pathway clone object.

      if (!oldClone) {
        const playlistsToClone = playlists.filter(p => {
          return p.attributes['PATHWAY-ID'] === clone['BASE-ID'];
        });
        playlistsToClone.forEach(p => {
          this.mainPlaylistLoader_.addClonePathway(clone, p);
        });
        this.contentSteeringController_.addAvailablePathway(id);
        continue;
      } // There have not been changes to the pathway clone object, so skip.


      if (this.equalPathwayClones_(oldClone, clone)) {
        continue;
      } // Update a preexisting cloned pathway.
      // True is set for the update flag.


      this.mainPlaylistLoader_.updateOrDeleteClone(clone, true);
      this.contentSteeringController_.addAvailablePathway(id);
    } // Deep copy contents of next to current pathways.


    this.contentSteeringController_.currentPathwayClones = new Map(JSON.parse(JSON.stringify([...nextPathwayClones])));
  }
  /**
   * Determines whether two pathway clone objects are equivalent.
   *
   * @param {Object} a The first pathway clone object.
   * @param {Object} b The second pathway clone object.
   * @return {boolean} True if the pathway clone objects are equal, false otherwise.
   */


  equalPathwayClones_(a, b) {
    if (a['BASE-ID'] !== b['BASE-ID'] || a.ID !== b.ID || a['URI-REPLACEMENT'].HOST !== b['URI-REPLACEMENT'].HOST) {
      return false;
    }

    const aParams = a['URI-REPLACEMENT'].PARAMS;
    const bParams = b['URI-REPLACEMENT'].PARAMS; // We need to iterate through both lists of params because one could be
    // missing a parameter that the other has.

    for (const p in aParams) {
      if (aParams[p] !== bParams[p]) {
        return false;
      }
    }

    for (const p in bParams) {
      if (aParams[p] !== bParams[p]) {
        return false;
      }
    }

    return true;
  }
  /**
   * Changes the current playlists for audio, video and subtitles after a new pathway
   * is chosen from content steering.
   */


  changeSegmentPathway_() {
    const nextPlaylist = this.selectPlaylist();
    this.pauseLoading(); // Switch audio and text track playlists if necessary in DASH

    if (this.contentSteeringController_.manifestType_ === 'DASH') {
      this.switchMediaForDASHContentSteering_();
    }

    this.switchMedia_(nextPlaylist, 'content-steering');
  }
  /**
   * Iterates through playlists and check their keyId set and compare with the
   * keyStatusMap, only enable playlists that have a usable key. If the playlist
   * has no keyId leave it enabled by default.
   */


  excludeNonUsablePlaylistsByKeyId_() {
    if (!this.mainPlaylistLoader_ || !this.mainPlaylistLoader_.main) {
      return;
    }

    let nonUsableKeyStatusCount = 0;
    const NON_USABLE = 'non-usable';
    this.mainPlaylistLoader_.main.playlists.forEach(playlist => {
      const keyIdSet = this.mainPlaylistLoader_.getKeyIdSet(playlist); // If the playlist doesn't have keyIDs lets not exclude it.

      if (!keyIdSet || !keyIdSet.size) {
        return;
      }

      keyIdSet.forEach(key => {
        const USABLE = 'usable';
        const hasUsableKeyStatus = this.keyStatusMap_.has(key) && this.keyStatusMap_.get(key) === USABLE;
        const nonUsableExclusion = playlist.lastExcludeReason_ === NON_USABLE && playlist.excludeUntil === Infinity;

        if (!hasUsableKeyStatus) {
          // Only exclude playlists that haven't already been excluded as non-usable.
          if (playlist.excludeUntil !== Infinity && playlist.lastExcludeReason_ !== NON_USABLE) {
            playlist.excludeUntil = Infinity;
            playlist.lastExcludeReason_ = NON_USABLE;
            this.logger_(`excluding playlist ${playlist.id} because the key ID ${key} doesn't exist in the keyStatusMap or is not ${USABLE}`);
          } // count all nonUsableKeyStatus


          nonUsableKeyStatusCount++;
        } else if (hasUsableKeyStatus && nonUsableExclusion) {
          delete playlist.excludeUntil;
          delete playlist.lastExcludeReason_;
          this.logger_(`enabling playlist ${playlist.id} because key ID ${key} is ${USABLE}`);
        }
      });
    }); // If for whatever reason every playlist has a non usable key status. Lets try re-including the SD renditions as a failsafe.

    if (nonUsableKeyStatusCount >= this.mainPlaylistLoader_.main.playlists.length) {
      this.mainPlaylistLoader_.main.playlists.forEach(playlist => {
        const isNonHD = playlist && playlist.attributes && playlist.attributes.RESOLUTION && playlist.attributes.RESOLUTION.height < 720;
        const excludedForNonUsableKey = playlist.excludeUntil === Infinity && playlist.lastExcludeReason_ === NON_USABLE;

        if (isNonHD && excludedForNonUsableKey) {
          // Only delete the excludeUntil so we don't try and re-exclude these playlists.
          delete playlist.excludeUntil;
          videojs.log.warn(`enabling non-HD playlist ${playlist.id} because all playlists were excluded due to ${NON_USABLE} key IDs`);
        }
      });
    }
  }
  /**
   * Adds a keystatus to the keystatus map, tries to convert to string if necessary.
   *
   * @param {any} keyId the keyId to add a status for
   * @param {string} status the status of the keyId
   */


  addKeyStatus_(keyId, status) {
    const isString = typeof keyId === 'string';
    const keyIdHexString = isString ? keyId : bufferToHexString(keyId);
    const formattedKeyIdString = keyIdHexString.slice(0, 32).toLowerCase();
    this.logger_(`KeyStatus '${status}' with key ID ${formattedKeyIdString} added to the keyStatusMap`);
    this.keyStatusMap_.set(formattedKeyIdString, status);
  }
  /**
   * Utility function for adding key status to the keyStatusMap and filtering usable encrypted playlists.
   *
   * @param {any} keyId the keyId from the keystatuschange event
   * @param {string} status the key status string
   */


  updatePlaylistByKeyStatus(keyId, status) {
    this.addKeyStatus_(keyId, status);

    if (!this.waitingForFastQualityPlaylistReceived_) {
      this.excludeNonUsableThenChangePlaylist_();
    } // Listen to loadedplaylist with a single listener and check for new contentProtection elements when a playlist is updated.


    this.mainPlaylistLoader_.off('loadedplaylist', this.excludeNonUsableThenChangePlaylist_.bind(this));
    this.mainPlaylistLoader_.on('loadedplaylist', this.excludeNonUsableThenChangePlaylist_.bind(this));
  }

  excludeNonUsableThenChangePlaylist_() {
    this.excludeNonUsablePlaylistsByKeyId_();
    this.fastQualityChange_();
  }

}

/**
 * Returns a function that acts as the Enable/disable playlist function.
 *
 * @param {PlaylistLoader} loader - The main playlist loader
 * @param {string} playlistID - id of the playlist
 * @param {Function} changePlaylistFn - A function to be called after a
 * playlist's enabled-state has been changed. Will NOT be called if a
 * playlist's enabled-state is unchanged
 * @param {boolean=} enable - Value to set the playlist enabled-state to
 * or if undefined returns the current enabled-state for the playlist
 * @return {Function} Function for setting/getting enabled
 */

const enableFunction = (loader, playlistID, changePlaylistFn) => enable => {
  const playlist = loader.main.playlists[playlistID];
  const incompatible = isIncompatible(playlist);
  const currentlyEnabled = isEnabled(playlist);

  if (typeof enable === 'undefined') {
    return currentlyEnabled;
  }

  if (enable) {
    delete playlist.disabled;
  } else {
    playlist.disabled = true;
  }

  if (enable !== currentlyEnabled && !incompatible) {
    // Ensure the outside world knows about our changes
    changePlaylistFn();

    if (enable) {
      loader.trigger('renditionenabled');
    } else {
      loader.trigger('renditiondisabled');
    }
  }

  return enable;
};
/**
 * The representation object encapsulates the publicly visible information
 * in a media playlist along with a setter/getter-type function (enabled)
 * for changing the enabled-state of a particular playlist entry
 *
 * @class Representation
 */


class Representation {
  constructor(vhsHandler, playlist, id) {
    const {
      playlistController_: pc
    } = vhsHandler;
    const qualityChangeFunction = pc.fastQualityChange_.bind(pc); // some playlist attributes are optional

    if (playlist.attributes) {
      const resolution = playlist.attributes.RESOLUTION;
      this.width = resolution && resolution.width;
      this.height = resolution && resolution.height;
      this.bandwidth = playlist.attributes.BANDWIDTH;
      this.frameRate = playlist.attributes['FRAME-RATE'];
    }

    this.codecs = codecsForPlaylist(pc.main(), playlist);
    this.playlist = playlist; // The id is simply the ordinality of the media playlist
    // within the main playlist

    this.id = id; // Partially-apply the enableFunction to create a playlist-
    // specific variant

    this.enabled = enableFunction(vhsHandler.playlists, playlist.id, qualityChangeFunction);
  }

}
/**
 * A mixin function that adds the `representations` api to an instance
 * of the VhsHandler class
 *
 * @param {VhsHandler} vhsHandler - An instance of VhsHandler to add the
 * representation API into
 */


const renditionSelectionMixin = function (vhsHandler) {
  // Add a single API-specific function to the VhsHandler instance
  vhsHandler.representations = () => {
    const main = vhsHandler.playlistController_.main();
    const playlists = isAudioOnly(main) ? vhsHandler.playlistController_.getAudioTrackPlaylists_() : main.playlists;

    if (!playlists) {
      return [];
    }

    return playlists.filter(media => !isIncompatible(media)).map((e, i) => new Representation(vhsHandler, e, e.id));
  };
};

/**
 * @file playback-watcher.js
 *
 * Playback starts, and now my watch begins. It shall not end until my death. I shall
 * take no wait, hold no uncleared timeouts, father no bad seeks. I shall wear no crowns
 * and win no glory. I shall live and die at my post. I am the corrector of the underflow.
 * I am the watcher of gaps. I am the shield that guards the realms of seekable. I pledge
 * my life and honor to the Playback Watch, for this Player and all the Players to come.
 */

const timerCancelEvents = ['seeking', 'seeked', 'pause', 'playing', 'error'];
/**
 * @class PlaybackWatcher
 */

class PlaybackWatcher {
  /**
   * Represents an PlaybackWatcher object.
   *
   * @class
   * @param {Object} options an object that includes the tech and settings
   */
  constructor(options) {
    this.playlistController_ = options.playlistController;
    this.tech_ = options.tech;
    this.seekable = options.seekable;
    this.allowSeeksWithinUnsafeLiveWindow = options.allowSeeksWithinUnsafeLiveWindow;
    this.liveRangeSafeTimeDelta = options.liveRangeSafeTimeDelta;
    this.media = options.media;
    this.consecutiveUpdates = 0;
    this.lastRecordedTime = null;
    this.checkCurrentTimeTimeout_ = null;
    this.logger_ = logger('PlaybackWatcher');
    this.logger_('initialize');

    const playHandler = () => this.monitorCurrentTime_();

    const canPlayHandler = () => this.monitorCurrentTime_();

    const waitingHandler = () => this.techWaiting_();

    const cancelTimerHandler = () => this.resetTimeUpdate_();

    const pc = this.playlistController_;
    const loaderTypes = ['main', 'subtitle', 'audio'];
    const loaderChecks = {};
    loaderTypes.forEach(type => {
      loaderChecks[type] = {
        reset: () => this.resetSegmentDownloads_(type),
        updateend: () => this.checkSegmentDownloads_(type)
      };
      pc[`${type}SegmentLoader_`].on('appendsdone', loaderChecks[type].updateend); // If a rendition switch happens during a playback stall where the buffer
      // isn't changing we want to reset. We cannot assume that the new rendition
      // will also be stalled, until after new appends.

      pc[`${type}SegmentLoader_`].on('playlistupdate', loaderChecks[type].reset); // Playback stalls should not be detected right after seeking.
      // This prevents one segment playlists (single vtt or single segment content)
      // from being detected as stalling. As the buffer will not change in those cases, since
      // the buffer is the entire video duration.

      this.tech_.on(['seeked', 'seeking'], loaderChecks[type].reset);
    });
    /**
     * We check if a seek was into a gap through the following steps:
     * 1. We get a seeking event and we do not get a seeked event. This means that
     *    a seek was attempted but not completed.
     * 2. We run `fixesBadSeeks_` on segment loader appends. This means that we already
     *    removed everything from our buffer and appended a segment, and should be ready
     *    to check for gaps.
     */

    const setSeekingHandlers = fn => {
      ['main', 'audio'].forEach(type => {
        pc[`${type}SegmentLoader_`][fn]('appended', this.seekingAppendCheck_);
      });
    };

    this.seekingAppendCheck_ = () => {
      if (this.fixesBadSeeks_()) {
        this.consecutiveUpdates = 0;
        this.lastRecordedTime = this.tech_.currentTime();
        setSeekingHandlers('off');
      }
    };

    this.clearSeekingAppendCheck_ = () => setSeekingHandlers('off');

    this.watchForBadSeeking_ = () => {
      this.clearSeekingAppendCheck_();
      setSeekingHandlers('on');
    };

    this.tech_.on('seeked', this.clearSeekingAppendCheck_);
    this.tech_.on('seeking', this.watchForBadSeeking_);
    this.tech_.on('waiting', waitingHandler);
    this.tech_.on(timerCancelEvents, cancelTimerHandler);
    this.tech_.on('canplay', canPlayHandler);
    /*
      An edge case exists that results in gaps not being skipped when they exist at the beginning of a stream. This case
      is surfaced in one of two ways:
       1)  The `waiting` event is fired before the player has buffered content, making it impossible
          to find or skip the gap. The `waiting` event is followed by a `play` event. On first play
          we can check if playback is stalled due to a gap, and skip the gap if necessary.
      2)  A source with a gap at the beginning of the stream is loaded programatically while the player
          is in a playing state. To catch this case, it's important that our one-time play listener is setup
          even if the player is in a playing state
    */

    this.tech_.one('play', playHandler); // Define the dispose function to clean up our events

    this.dispose = () => {
      this.clearSeekingAppendCheck_();
      this.logger_('dispose');
      this.tech_.off('waiting', waitingHandler);
      this.tech_.off(timerCancelEvents, cancelTimerHandler);
      this.tech_.off('canplay', canPlayHandler);
      this.tech_.off('play', playHandler);
      this.tech_.off('seeking', this.watchForBadSeeking_);
      this.tech_.off('seeked', this.clearSeekingAppendCheck_);
      loaderTypes.forEach(type => {
        pc[`${type}SegmentLoader_`].off('appendsdone', loaderChecks[type].updateend);
        pc[`${type}SegmentLoader_`].off('playlistupdate', loaderChecks[type].reset);
        this.tech_.off(['seeked', 'seeking'], loaderChecks[type].reset);
      });

      if (this.checkCurrentTimeTimeout_) {
        window$1.clearTimeout(this.checkCurrentTimeTimeout_);
      }

      this.resetTimeUpdate_();
    };
  }
  /**
   * Periodically check current time to see if playback stopped
   *
   * @private
   */


  monitorCurrentTime_() {
    this.checkCurrentTime_();

    if (this.checkCurrentTimeTimeout_) {
      window$1.clearTimeout(this.checkCurrentTimeTimeout_);
    } // 42 = 24 fps // 250 is what Webkit uses // FF uses 15


    this.checkCurrentTimeTimeout_ = window$1.setTimeout(this.monitorCurrentTime_.bind(this), 250);
  }
  /**
   * Reset stalled download stats for a specific type of loader
   *
   * @param {string} type
   *        The segment loader type to check.
   *
   * @listens SegmentLoader#playlistupdate
   * @listens Tech#seeking
   * @listens Tech#seeked
   */


  resetSegmentDownloads_(type) {
    const loader = this.playlistController_[`${type}SegmentLoader_`];

    if (this[`${type}StalledDownloads_`] > 0) {
      this.logger_(`resetting possible stalled download count for ${type} loader`);
    }

    this[`${type}StalledDownloads_`] = 0;
    this[`${type}Buffered_`] = loader.buffered_();
  }
  /**
   * Checks on every segment `appendsdone` to see
   * if segment appends are making progress. If they are not
   * and we are still downloading bytes. We exclude the playlist.
   *
   * @param {string} type
   *        The segment loader type to check.
   *
   * @listens SegmentLoader#appendsdone
   */


  checkSegmentDownloads_(type) {
    const pc = this.playlistController_;
    const loader = pc[`${type}SegmentLoader_`];
    const buffered = loader.buffered_();
    const isBufferedDifferent = isRangeDifferent(this[`${type}Buffered_`], buffered);
    this[`${type}Buffered_`] = buffered; // if another watcher is going to fix the issue or
    // the buffered value for this loader changed
    // appends are working

    if (isBufferedDifferent) {
      this.resetSegmentDownloads_(type);
      return;
    }

    this[`${type}StalledDownloads_`]++;
    this.logger_(`found #${this[`${type}StalledDownloads_`]} ${type} appends that did not increase buffer (possible stalled download)`, {
      playlistId: loader.playlist_ && loader.playlist_.id,
      buffered: timeRangesToArray(buffered)
    }); // after 10 possibly stalled appends with no reset, exclude

    if (this[`${type}StalledDownloads_`] < 10) {
      return;
    }

    this.logger_(`${type} loader stalled download exclusion`);
    this.resetSegmentDownloads_(type);
    this.tech_.trigger({
      type: 'usage',
      name: `vhs-${type}-download-exclusion`
    });

    if (type === 'subtitle') {
      return;
    } // TODO: should we exclude audio tracks rather than main tracks
    // when type is audio?


    pc.excludePlaylist({
      error: {
        message: `Excessive ${type} segment downloading detected.`
      },
      playlistExclusionDuration: Infinity
    });
  }
  /**
   * The purpose of this function is to emulate the "waiting" event on
   * browsers that do not emit it when they are waiting for more
   * data to continue playback
   *
   * @private
   */


  checkCurrentTime_() {
    if (this.tech_.paused() || this.tech_.seeking()) {
      return;
    }

    const currentTime = this.tech_.currentTime();
    const buffered = this.tech_.buffered();

    if (this.lastRecordedTime === currentTime && (!buffered.length || currentTime + SAFE_TIME_DELTA >= buffered.end(buffered.length - 1))) {
      // If current time is at the end of the final buffered region, then any playback
      // stall is most likely caused by buffering in a low bandwidth environment. The tech
      // should fire a `waiting` event in this scenario, but due to browser and tech
      // inconsistencies. Calling `techWaiting_` here allows us to simulate
      // responding to a native `waiting` event when the tech fails to emit one.
      return this.techWaiting_();
    }

    if (this.consecutiveUpdates >= 5 && currentTime === this.lastRecordedTime) {
      this.consecutiveUpdates++;
      this.waiting_();
    } else if (currentTime === this.lastRecordedTime) {
      this.consecutiveUpdates++;
    } else {
      this.consecutiveUpdates = 0;
      this.lastRecordedTime = currentTime;
    }
  }
  /**
   * Resets the 'timeupdate' mechanism designed to detect that we are stalled
   *
   * @private
   */


  resetTimeUpdate_() {
    this.consecutiveUpdates = 0;
  }
  /**
   * Fixes situations where there's a bad seek
   *
   * @return {boolean} whether an action was taken to fix the seek
   * @private
   */


  fixesBadSeeks_() {
    const seeking = this.tech_.seeking();

    if (!seeking) {
      return false;
    } // TODO: It's possible that these seekable checks should be moved out of this function
    // and into a function that runs on seekablechange. It's also possible that we only need
    // afterSeekableWindow as the buffered check at the bottom is good enough to handle before
    // seekable range.


    const seekable = this.seekable();
    const currentTime = this.tech_.currentTime();
    const isAfterSeekableRange = this.afterSeekableWindow_(seekable, currentTime, this.media(), this.allowSeeksWithinUnsafeLiveWindow);
    let seekTo;

    if (isAfterSeekableRange) {
      const seekableEnd = seekable.end(seekable.length - 1); // sync to live point (if VOD, our seekable was updated and we're simply adjusting)

      seekTo = seekableEnd;
    }

    if (this.beforeSeekableWindow_(seekable, currentTime)) {
      const seekableStart = seekable.start(0); // sync to the beginning of the live window
      // provide a buffer of .1 seconds to handle rounding/imprecise numbers

      seekTo = seekableStart + ( // if the playlist is too short and the seekable range is an exact time (can
      // happen in live with a 3 segment playlist), then don't use a time delta
      seekableStart === seekable.end(0) ? 0 : SAFE_TIME_DELTA);
    }

    if (typeof seekTo !== 'undefined') {
      this.logger_(`Trying to seek outside of seekable at time ${currentTime} with ` + `seekable range ${printableRange(seekable)}. Seeking to ` + `${seekTo}.`);
      this.tech_.setCurrentTime(seekTo);
      return true;
    }

    const sourceUpdater = this.playlistController_.sourceUpdater_;
    const buffered = this.tech_.buffered();
    const audioBuffered = sourceUpdater.audioBuffer ? sourceUpdater.audioBuffered() : null;
    const videoBuffered = sourceUpdater.videoBuffer ? sourceUpdater.videoBuffered() : null;
    const media = this.media(); // verify that at least two segment durations or one part duration have been
    // appended before checking for a gap.

    const minAppendedDuration = media.partTargetDuration ? media.partTargetDuration : (media.targetDuration - TIME_FUDGE_FACTOR) * 2; // verify that at least two segment durations have been
    // appended before checking for a gap.

    const bufferedToCheck = [audioBuffered, videoBuffered];

    for (let i = 0; i < bufferedToCheck.length; i++) {
      // skip null buffered
      if (!bufferedToCheck[i]) {
        continue;
      }

      const timeAhead = timeAheadOf(bufferedToCheck[i], currentTime); // if we are less than two video/audio segment durations or one part
      // duration behind we haven't appended enough to call this a bad seek.

      if (timeAhead < minAppendedDuration) {
        return false;
      }
    }

    const nextRange = findNextRange(buffered, currentTime); // we have appended enough content, but we don't have anything buffered
    // to seek over the gap

    if (nextRange.length === 0) {
      return false;
    }

    seekTo = nextRange.start(0) + SAFE_TIME_DELTA;
    this.logger_(`Buffered region starts (${nextRange.start(0)}) ` + ` just beyond seek point (${currentTime}). Seeking to ${seekTo}.`);
    this.tech_.setCurrentTime(seekTo);
    return true;
  }
  /**
   * Handler for situations when we determine the player is waiting.
   *
   * @private
   */


  waiting_() {
    if (this.techWaiting_()) {
      return;
    } // All tech waiting checks failed. Use last resort correction


    const currentTime = this.tech_.currentTime();
    const buffered = this.tech_.buffered();
    const currentRange = findRange(buffered, currentTime); // Sometimes the player can stall for unknown reasons within a contiguous buffered
    // region with no indication that anything is amiss (seen in Firefox). Seeking to
    // currentTime is usually enough to kickstart the player. This checks that the player
    // is currently within a buffered region before attempting a corrective seek.
    // Chrome does not appear to continue `timeupdate` events after a `waiting` event
    // until there is ~ 3 seconds of forward buffer available. PlaybackWatcher should also
    // make sure there is ~3 seconds of forward buffer before taking any corrective action
    // to avoid triggering an `unknownwaiting` event when the network is slow.

    if (currentRange.length && currentTime + 3 <= currentRange.end(0)) {
      this.resetTimeUpdate_();
      this.tech_.setCurrentTime(currentTime);
      this.logger_(`Stopped at ${currentTime} while inside a buffered region ` + `[${currentRange.start(0)} -> ${currentRange.end(0)}]. Attempting to resume ` + 'playback by seeking to the current time.'); // unknown waiting corrections may be useful for monitoring QoS

      this.tech_.trigger({
        type: 'usage',
        name: 'vhs-unknown-waiting'
      });
      return;
    }
  }
  /**
   * Handler for situations when the tech fires a `waiting` event
   *
   * @return {boolean}
   *         True if an action (or none) was needed to correct the waiting. False if no
   *         checks passed
   * @private
   */


  techWaiting_() {
    const seekable = this.seekable();
    const currentTime = this.tech_.currentTime();

    if (this.tech_.seeking()) {
      // Tech is seeking or already waiting on another action, no action needed
      return true;
    }

    if (this.beforeSeekableWindow_(seekable, currentTime)) {
      const livePoint = seekable.end(seekable.length - 1);
      this.logger_(`Fell out of live window at time ${currentTime}. Seeking to ` + `live point (seekable end) ${livePoint}`);
      this.resetTimeUpdate_();
      this.tech_.setCurrentTime(livePoint); // live window resyncs may be useful for monitoring QoS

      this.tech_.trigger({
        type: 'usage',
        name: 'vhs-live-resync'
      });
      return true;
    }

    const sourceUpdater = this.tech_.vhs.playlistController_.sourceUpdater_;
    const buffered = this.tech_.buffered();
    const videoUnderflow = this.videoUnderflow_({
      audioBuffered: sourceUpdater.audioBuffered(),
      videoBuffered: sourceUpdater.videoBuffered(),
      currentTime
    });

    if (videoUnderflow) {
      // Even though the video underflowed and was stuck in a gap, the audio overplayed
      // the gap, leading currentTime into a buffered range. Seeking to currentTime
      // allows the video to catch up to the audio position without losing any audio
      // (only suffering ~3 seconds of frozen video and a pause in audio playback).
      this.resetTimeUpdate_();
      this.tech_.setCurrentTime(currentTime); // video underflow may be useful for monitoring QoS

      this.tech_.trigger({
        type: 'usage',
        name: 'vhs-video-underflow'
      });
      return true;
    }

    const nextRange = findNextRange(buffered, currentTime); // check for gap

    if (nextRange.length > 0) {
      this.logger_(`Stopped at ${currentTime} and seeking to ${nextRange.start(0)}`);
      this.resetTimeUpdate_();
      this.skipTheGap_(currentTime);
      return true;
    } // All checks failed. Returning false to indicate failure to correct waiting


    return false;
  }

  afterSeekableWindow_(seekable, currentTime, playlist, allowSeeksWithinUnsafeLiveWindow = false) {
    if (!seekable.length) {
      // we can't make a solid case if there's no seekable, default to false
      return false;
    }

    let allowedEnd = seekable.end(seekable.length - 1) + SAFE_TIME_DELTA;
    const isLive = !playlist.endList;
    const isLLHLS = typeof playlist.partTargetDuration === 'number';

    if (isLive && (isLLHLS || allowSeeksWithinUnsafeLiveWindow)) {
      allowedEnd = seekable.end(seekable.length - 1) + playlist.targetDuration * 3;
    }

    if (currentTime > allowedEnd) {
      return true;
    }

    return false;
  }

  beforeSeekableWindow_(seekable, currentTime) {
    if (seekable.length && // can't fall before 0 and 0 seekable start identifies VOD stream
    seekable.start(0) > 0 && currentTime < seekable.start(0) - this.liveRangeSafeTimeDelta) {
      return true;
    }

    return false;
  }

  videoUnderflow_({
    videoBuffered,
    audioBuffered,
    currentTime
  }) {
    // audio only content will not have video underflow :)
    if (!videoBuffered) {
      return;
    }

    let gap; // find a gap in demuxed content.

    if (videoBuffered.length && audioBuffered.length) {
      // in Chrome audio will continue to play for ~3s when we run out of video
      // so we have to check that the video buffer did have some buffer in the
      // past.
      const lastVideoRange = findRange(videoBuffered, currentTime - 3);
      const videoRange = findRange(videoBuffered, currentTime);
      const audioRange = findRange(audioBuffered, currentTime);

      if (audioRange.length && !videoRange.length && lastVideoRange.length) {
        gap = {
          start: lastVideoRange.end(0),
          end: audioRange.end(0)
        };
      } // find a gap in muxed content.

    } else {
      const nextRange = findNextRange(videoBuffered, currentTime); // Even if there is no available next range, there is still a possibility we are
      // stuck in a gap due to video underflow.

      if (!nextRange.length) {
        gap = this.gapFromVideoUnderflow_(videoBuffered, currentTime);
      }
    }

    if (gap) {
      this.logger_(`Encountered a gap in video from ${gap.start} to ${gap.end}. ` + `Seeking to current time ${currentTime}`);
      return true;
    }

    return false;
  }
  /**
   * Timer callback. If playback still has not proceeded, then we seek
   * to the start of the next buffered region.
   *
   * @private
   */


  skipTheGap_(scheduledCurrentTime) {
    const buffered = this.tech_.buffered();
    const currentTime = this.tech_.currentTime();
    const nextRange = findNextRange(buffered, currentTime);
    this.resetTimeUpdate_();

    if (nextRange.length === 0 || currentTime !== scheduledCurrentTime) {
      return;
    }

    this.logger_('skipTheGap_:', 'currentTime:', currentTime, 'scheduled currentTime:', scheduledCurrentTime, 'nextRange start:', nextRange.start(0)); // only seek if we still have not played

    this.tech_.setCurrentTime(nextRange.start(0) + TIME_FUDGE_FACTOR);
    this.tech_.trigger({
      type: 'usage',
      name: 'vhs-gap-skip'
    });
  }

  gapFromVideoUnderflow_(buffered, currentTime) {
    // At least in Chrome, if there is a gap in the video buffer, the audio will continue
    // playing for ~3 seconds after the video gap starts. This is done to account for
    // video buffer underflow/underrun (note that this is not done when there is audio
    // buffer underflow/underrun -- in that case the video will stop as soon as it
    // encounters the gap, as audio stalls are more noticeable/jarring to a user than
    // video stalls). The player's time will reflect the playthrough of audio, so the
    // time will appear as if we are in a buffered region, even if we are stuck in a
    // "gap."
    //
    // Example:
    // video buffer:   0 => 10.1, 10.2 => 20
    // audio buffer:   0 => 20
    // overall buffer: 0 => 10.1, 10.2 => 20
    // current time: 13
    //
    // Chrome's video froze at 10 seconds, where the video buffer encountered the gap,
    // however, the audio continued playing until it reached ~3 seconds past the gap
    // (13 seconds), at which point it stops as well. Since current time is past the
    // gap, findNextRange will return no ranges.
    //
    // To check for this issue, we see if there is a gap that starts somewhere within
    // a 3 second range (3 seconds +/- 1 second) back from our current time.
    const gaps = findGaps(buffered);

    for (let i = 0; i < gaps.length; i++) {
      const start = gaps.start(i);
      const end = gaps.end(i); // gap is starts no more than 4 seconds back

      if (currentTime - start < 4 && currentTime - start > 2) {
        return {
          start,
          end
        };
      }
    }

    return null;
  }

}

const defaultOptions = {
  errorInterval: 30,

  getSource(next) {
    const tech = this.tech({
      IWillNotUseThisInPlugins: true
    });
    const sourceObj = tech.currentSource_ || this.currentSource();
    return next(sourceObj);
  }

};
/**
 * Main entry point for the plugin
 *
 * @param {Player} player a reference to a videojs Player instance
 * @param {Object} [options] an object with plugin options
 * @private
 */

const initPlugin = function (player, options) {
  let lastCalled = 0;
  let seekTo = 0;
  const localOptions = merge(defaultOptions, options);
  player.ready(() => {
    player.trigger({
      type: 'usage',
      name: 'vhs-error-reload-initialized'
    });
  });
  /**
   * Player modifications to perform that must wait until `loadedmetadata`
   * has been triggered
   *
   * @private
   */

  const loadedMetadataHandler = function () {
    if (seekTo) {
      player.currentTime(seekTo);
    }
  };
  /**
   * Set the source on the player element, play, and seek if necessary
   *
   * @param {Object} sourceObj An object specifying the source url and mime-type to play
   * @private
   */


  const setSource = function (sourceObj) {
    if (sourceObj === null || sourceObj === undefined) {
      return;
    }

    seekTo = player.duration() !== Infinity && player.currentTime() || 0;
    player.one('loadedmetadata', loadedMetadataHandler);
    player.src(sourceObj);
    player.trigger({
      type: 'usage',
      name: 'vhs-error-reload'
    });
    player.play();
  };
  /**
   * Attempt to get a source from either the built-in getSource function
   * or a custom function provided via the options
   *
   * @private
   */


  const errorHandler = function () {
    // Do not attempt to reload the source if a source-reload occurred before
    // 'errorInterval' time has elapsed since the last source-reload
    if (Date.now() - lastCalled < localOptions.errorInterval * 1000) {
      player.trigger({
        type: 'usage',
        name: 'vhs-error-reload-canceled'
      });
      return;
    }

    if (!localOptions.getSource || typeof localOptions.getSource !== 'function') {
      videojs.log.error('ERROR: reloadSourceOnError - The option getSource must be a function!');
      return;
    }

    lastCalled = Date.now();
    return localOptions.getSource.call(player, setSource);
  };
  /**
   * Unbind any event handlers that were bound by the plugin
   *
   * @private
   */


  const cleanupEvents = function () {
    player.off('loadedmetadata', loadedMetadataHandler);
    player.off('error', errorHandler);
    player.off('dispose', cleanupEvents);
  };
  /**
   * Cleanup before re-initializing the plugin
   *
   * @param {Object} [newOptions] an object with plugin options
   * @private
   */


  const reinitPlugin = function (newOptions) {
    cleanupEvents();
    initPlugin(player, newOptions);
  };

  player.on('error', errorHandler);
  player.on('dispose', cleanupEvents); // Overwrite the plugin function so that we can correctly cleanup before
  // initializing the plugin

  player.reloadSourceOnError = reinitPlugin;
};
/**
 * Reload the source when an error is detected as long as there
 * wasn't an error previously within the last 30 seconds
 *
 * @param {Object} [options] an object with plugin options
 */


const reloadSourceOnError = function (options) {
  initPlugin(this, options);
};

var version$4 = "3.9.1";

var version$3 = "7.0.2";

var version$2 = "1.3.0";

var version$1 = "7.1.0";

var version = "4.0.1";

/**
 * @file videojs-http-streaming.js
 *
 * The main file for the VHS project.
 * License: https://github.com/videojs/videojs-http-streaming/blob/main/LICENSE
 */
const Vhs = {
  PlaylistLoader,
  Playlist,
  utils,
  STANDARD_PLAYLIST_SELECTOR: lastBandwidthSelector,
  INITIAL_PLAYLIST_SELECTOR: lowestBitrateCompatibleVariantSelector,
  lastBandwidthSelector,
  movingAverageBandwidthSelector,
  comparePlaylistBandwidth,
  comparePlaylistResolution,
  xhr: xhrFactory()
}; // Define getter/setters for config properties

Object.keys(Config).forEach(prop => {
  Object.defineProperty(Vhs, prop, {
    get() {
      videojs.log.warn(`using Vhs.${prop} is UNSAFE be sure you know what you are doing`);
      return Config[prop];
    },

    set(value) {
      videojs.log.warn(`using Vhs.${prop} is UNSAFE be sure you know what you are doing`);

      if (typeof value !== 'number' || value < 0) {
        videojs.log.warn(`value of Vhs.${prop} must be greater than or equal to 0`);
        return;
      }

      Config[prop] = value;
    }

  });
});
const LOCAL_STORAGE_KEY = 'videojs-vhs';
/**
 * Updates the selectedIndex of the QualityLevelList when a mediachange happens in vhs.
 *
 * @param {QualityLevelList} qualityLevels The QualityLevelList to update.
 * @param {PlaylistLoader} playlistLoader PlaylistLoader containing the new media info.
 * @function handleVhsMediaChange
 */

const handleVhsMediaChange = function (qualityLevels, playlistLoader) {
  const newPlaylist = playlistLoader.media();
  let selectedIndex = -1;

  for (let i = 0; i < qualityLevels.length; i++) {
    if (qualityLevels[i].id === newPlaylist.id) {
      selectedIndex = i;
      break;
    }
  }

  qualityLevels.selectedIndex_ = selectedIndex;
  qualityLevels.trigger({
    selectedIndex,
    type: 'change'
  });
};
/**
 * Adds quality levels to list once playlist metadata is available
 *
 * @param {QualityLevelList} qualityLevels The QualityLevelList to attach events to.
 * @param {Object} vhs Vhs object to listen to for media events.
 * @function handleVhsLoadedMetadata
 */


const handleVhsLoadedMetadata = function (qualityLevels, vhs) {
  vhs.representations().forEach(rep => {
    qualityLevels.addQualityLevel(rep);
  });
  handleVhsMediaChange(qualityLevels, vhs.playlists);
}; // VHS is a source handler, not a tech. Make sure attempts to use it
// as one do not cause exceptions.


Vhs.canPlaySource = function () {
  return videojs.log.warn('VHS is no longer a tech. Please remove it from ' + 'your player\'s techOrder.');
};

const emeKeySystems = (keySystemOptions, mainPlaylist, audioPlaylist) => {
  if (!keySystemOptions) {
    return keySystemOptions;
  }

  let codecs = {};

  if (mainPlaylist && mainPlaylist.attributes && mainPlaylist.attributes.CODECS) {
    codecs = unwrapCodecList(parseCodecs(mainPlaylist.attributes.CODECS));
  }

  if (audioPlaylist && audioPlaylist.attributes && audioPlaylist.attributes.CODECS) {
    codecs.audio = audioPlaylist.attributes.CODECS;
  }

  const videoContentType = getMimeForCodec(codecs.video);
  const audioContentType = getMimeForCodec(codecs.audio); // upsert the content types based on the selected playlist

  const keySystemContentTypes = {};

  for (const keySystem in keySystemOptions) {
    keySystemContentTypes[keySystem] = {};

    if (audioContentType) {
      keySystemContentTypes[keySystem].audioContentType = audioContentType;
    }

    if (videoContentType) {
      keySystemContentTypes[keySystem].videoContentType = videoContentType;
    } // Default to using the video playlist's PSSH even though they may be different, as
    // videojs-contrib-eme will only accept one in the options.
    //
    // This shouldn't be an issue for most cases as early intialization will handle all
    // unique PSSH values, and if they aren't, then encrypted events should have the
    // specific information needed for the unique license.


    if (mainPlaylist.contentProtection && mainPlaylist.contentProtection[keySystem] && mainPlaylist.contentProtection[keySystem].pssh) {
      keySystemContentTypes[keySystem].pssh = mainPlaylist.contentProtection[keySystem].pssh;
    } // videojs-contrib-eme accepts the option of specifying: 'com.some.cdm': 'url'
    // so we need to prevent overwriting the URL entirely


    if (typeof keySystemOptions[keySystem] === 'string') {
      keySystemContentTypes[keySystem].url = keySystemOptions[keySystem];
    }
  }

  return merge(keySystemOptions, keySystemContentTypes);
};
/**
 * @typedef {Object} KeySystems
 *
 * keySystems configuration for https://github.com/videojs/videojs-contrib-eme
 * Note: not all options are listed here.
 *
 * @property {Uint8Array} [pssh]
 *           Protection System Specific Header
 */

/**
 * Goes through all the playlists and collects an array of KeySystems options objects
 * containing each playlist's keySystems and their pssh values, if available.
 *
 * @param {Object[]} playlists
 *        The playlists to look through
 * @param {string[]} keySystems
 *        The keySystems to collect pssh values for
 *
 * @return {KeySystems[]}
 *         An array of KeySystems objects containing available key systems and their
 *         pssh values
 */


const getAllPsshKeySystemsOptions = (playlists, keySystems) => {
  return playlists.reduce((keySystemsArr, playlist) => {
    if (!playlist.contentProtection) {
      return keySystemsArr;
    }

    const keySystemsOptions = keySystems.reduce((keySystemsObj, keySystem) => {
      const keySystemOptions = playlist.contentProtection[keySystem];

      if (keySystemOptions && keySystemOptions.pssh) {
        keySystemsObj[keySystem] = {
          pssh: keySystemOptions.pssh
        };
      }

      return keySystemsObj;
    }, {});

    if (Object.keys(keySystemsOptions).length) {
      keySystemsArr.push(keySystemsOptions);
    }

    return keySystemsArr;
  }, []);
};
/**
 * Returns a promise that waits for the
 * [eme plugin](https://github.com/videojs/videojs-contrib-eme) to create a key session.
 *
 * Works around https://bugs.chromium.org/p/chromium/issues/detail?id=895449 in non-IE11
 * browsers.
 *
 * As per the above ticket, this is particularly important for Chrome, where, if
 * unencrypted content is appended before encrypted content and the key session has not
 * been created, a MEDIA_ERR_DECODE will be thrown once the encrypted content is reached
 * during playback.
 *
 * @param {Object} player
 *        The player instance
 * @param {Object[]} sourceKeySystems
 *        The key systems options from the player source
 * @param {Object} [audioMedia]
 *        The active audio media playlist (optional)
 * @param {Object[]} mainPlaylists
 *        The playlists found on the main playlist object
 *
 * @return {Object}
 *         Promise that resolves when the key session has been created
 */


const waitForKeySessionCreation = ({
  player,
  sourceKeySystems,
  audioMedia,
  mainPlaylists
}) => {
  if (!player.eme.initializeMediaKeys) {
    return Promise.resolve();
  } // TODO should all audio PSSH values be initialized for DRM?
  //
  // All unique video rendition pssh values are initialized for DRM, but here only
  // the initial audio playlist license is initialized. In theory, an encrypted
  // event should be fired if the user switches to an alternative audio playlist
  // where a license is required, but this case hasn't yet been tested. In addition, there
  // may be many alternate audio playlists unlikely to be used (e.g., multiple different
  // languages).


  const playlists = audioMedia ? mainPlaylists.concat([audioMedia]) : mainPlaylists;
  const keySystemsOptionsArr = getAllPsshKeySystemsOptions(playlists, Object.keys(sourceKeySystems));
  const initializationFinishedPromises = [];
  const keySessionCreatedPromises = []; // Since PSSH values are interpreted as initData, EME will dedupe any duplicates. The
  // only place where it should not be deduped is for ms-prefixed APIs, but
  // the existence of modern EME APIs in addition to
  // ms-prefixed APIs on Edge should prevent this from being a concern.
  // initializeMediaKeys also won't use the webkit-prefixed APIs.

  keySystemsOptionsArr.forEach(keySystemsOptions => {
    keySessionCreatedPromises.push(new Promise((resolve, reject) => {
      player.tech_.one('keysessioncreated', resolve);
    }));
    initializationFinishedPromises.push(new Promise((resolve, reject) => {
      player.eme.initializeMediaKeys({
        keySystems: keySystemsOptions
      }, err => {
        if (err) {
          reject(err);
          return;
        }

        resolve();
      });
    }));
  }); // The reasons Promise.race is chosen over Promise.any:
  //
  // * Promise.any is only available in Safari 14+.
  // * None of these promises are expected to reject. If they do reject, it might be
  //   better here for the race to surface the rejection, rather than mask it by using
  //   Promise.any.

  return Promise.race([// If a session was previously created, these will all finish resolving without
  // creating a new session, otherwise it will take until the end of all license
  // requests, which is why the key session check is used (to make setup much faster).
  Promise.all(initializationFinishedPromises), // Once a single session is created, the browser knows DRM will be used.
  Promise.race(keySessionCreatedPromises)]);
};
/**
 * If the [eme](https://github.com/videojs/videojs-contrib-eme) plugin is available, and
 * there are keySystems on the source, sets up source options to prepare the source for
 * eme.
 *
 * @param {Object} player
 *        The player instance
 * @param {Object[]} sourceKeySystems
 *        The key systems options from the player source
 * @param {Object} media
 *        The active media playlist
 * @param {Object} [audioMedia]
 *        The active audio media playlist (optional)
 *
 * @return {boolean}
 *         Whether or not options were configured and EME is available
 */

const setupEmeOptions = ({
  player,
  sourceKeySystems,
  media,
  audioMedia
}) => {
  const sourceOptions = emeKeySystems(sourceKeySystems, media, audioMedia);

  if (!sourceOptions) {
    return false;
  }

  player.currentSource().keySystems = sourceOptions; // eme handles the rest of the setup, so if it is missing
  // do nothing.

  if (sourceOptions && !player.eme) {
    videojs.log.warn('DRM encrypted source cannot be decrypted without a DRM plugin');
    return false;
  }

  return true;
};

const getVhsLocalStorage = () => {
  if (!window$1.localStorage) {
    return null;
  }

  const storedObject = window$1.localStorage.getItem(LOCAL_STORAGE_KEY);

  if (!storedObject) {
    return null;
  }

  try {
    return JSON.parse(storedObject);
  } catch (e) {
    // someone may have tampered with the value
    return null;
  }
};

const updateVhsLocalStorage = options => {
  if (!window$1.localStorage) {
    return false;
  }

  let objectToStore = getVhsLocalStorage();
  objectToStore = objectToStore ? merge(objectToStore, options) : options;

  try {
    window$1.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(objectToStore));
  } catch (e) {
    // Throws if storage is full (e.g., always on iOS 5+ Safari private mode, where
    // storage is set to 0).
    // https://developer.mozilla.org/en-US/docs/Web/API/Storage/setItem#Exceptions
    // No need to perform any operation.
    return false;
  }

  return objectToStore;
};
/**
 * Parses VHS-supported media types from data URIs. See
 * https://developer.mozilla.org/en-US/docs/Web/HTTP/Basics_of_HTTP/Data_URIs
 * for information on data URIs.
 *
 * @param {string} dataUri
 *        The data URI
 *
 * @return {string|Object}
 *         The parsed object/string, or the original string if no supported media type
 *         was found
 */


const expandDataUri = dataUri => {
  if (dataUri.toLowerCase().indexOf('data:application/vnd.videojs.vhs+json,') === 0) {
    return JSON.parse(dataUri.substring(dataUri.indexOf(',') + 1));
  } // no known case for this data URI, return the string as-is


  return dataUri;
};
/**
 * Adds a request hook to an xhr object
 *
 * @param {Object} xhr object to add the onRequest hook to
 * @param {function} callback hook function for an xhr request
 */


const addOnRequestHook = (xhr, callback) => {
  if (!xhr._requestCallbackSet) {
    xhr._requestCallbackSet = new Set();
  }

  xhr._requestCallbackSet.add(callback);
};
/**
 * Adds a response hook to an xhr object
 *
 * @param {Object} xhr object to add the onResponse hook to
 * @param {function} callback hook function for an xhr response
 */


const addOnResponseHook = (xhr, callback) => {
  if (!xhr._responseCallbackSet) {
    xhr._responseCallbackSet = new Set();
  }

  xhr._responseCallbackSet.add(callback);
};
/**
 * Removes a request hook on an xhr object, deletes the onRequest set if empty.
 *
 * @param {Object} xhr object to remove the onRequest hook from
 * @param {function} callback hook function to remove
 */


const removeOnRequestHook = (xhr, callback) => {
  if (!xhr._requestCallbackSet) {
    return;
  }

  xhr._requestCallbackSet.delete(callback);

  if (!xhr._requestCallbackSet.size) {
    delete xhr._requestCallbackSet;
  }
};
/**
 * Removes a response hook on an xhr object, deletes the onResponse set if empty.
 *
 * @param {Object} xhr object to remove the onResponse hook from
 * @param {function} callback hook function to remove
 */


const removeOnResponseHook = (xhr, callback) => {
  if (!xhr._responseCallbackSet) {
    return;
  }

  xhr._responseCallbackSet.delete(callback);

  if (!xhr._responseCallbackSet.size) {
    delete xhr._responseCallbackSet;
  }
};
/**
 * Whether the browser has built-in HLS support.
 */


Vhs.supportsNativeHls = function () {
  if (!document || !document.createElement) {
    return false;
  }

  const video = document.createElement('video'); // native HLS is definitely not supported if HTML5 video isn't

  if (!videojs.getTech('Html5').isSupported()) {
    return false;
  } // HLS manifests can go by many mime-types


  const canPlay = [// Apple santioned
  'application/vnd.apple.mpegurl', // Apple sanctioned for backwards compatibility
  'audio/mpegurl', // Very common
  'audio/x-mpegurl', // Very common
  'application/x-mpegurl', // Included for completeness
  'video/x-mpegurl', 'video/mpegurl', 'application/mpegurl'];
  return canPlay.some(function (canItPlay) {
    return /maybe|probably/i.test(video.canPlayType(canItPlay));
  });
}();

Vhs.supportsNativeDash = function () {
  if (!document || !document.createElement || !videojs.getTech('Html5').isSupported()) {
    return false;
  }

  return /maybe|probably/i.test(document.createElement('video').canPlayType('application/dash+xml'));
}();

Vhs.supportsTypeNatively = type => {
  if (type === 'hls') {
    return Vhs.supportsNativeHls;
  }

  if (type === 'dash') {
    return Vhs.supportsNativeDash;
  }

  return false;
};
/**
 * VHS is a source handler, not a tech. Make sure attempts to use it
 * as one do not cause exceptions.
 */


Vhs.isSupported = function () {
  return videojs.log.warn('VHS is no longer a tech. Please remove it from ' + 'your player\'s techOrder.');
};
/**
 * A global function for setting an onRequest hook
 *
 * @param {function} callback for request modifiction
 */


Vhs.xhr.onRequest = function (callback) {
  addOnRequestHook(Vhs.xhr, callback);
};
/**
 * A global function for setting an onResponse hook
 *
 * @param {callback} callback for response data retrieval
 */


Vhs.xhr.onResponse = function (callback) {
  addOnResponseHook(Vhs.xhr, callback);
};
/**
 * Deletes a global onRequest callback if it exists
 *
 * @param {function} callback to delete from the global set
 */


Vhs.xhr.offRequest = function (callback) {
  removeOnRequestHook(Vhs.xhr, callback);
};
/**
 * Deletes a global onResponse callback if it exists
 *
 * @param {function} callback to delete from the global set
 */


Vhs.xhr.offResponse = function (callback) {
  removeOnResponseHook(Vhs.xhr, callback);
};

const Component = videojs.getComponent('Component');
/**
 * The Vhs Handler object, where we orchestrate all of the parts
 * of VHS to interact with video.js
 *
 * @class VhsHandler
 * @extends videojs.Component
 * @param {Object} source the soruce object
 * @param {Tech} tech the parent tech object
 * @param {Object} options optional and required options
 */

class VhsHandler extends Component {
  constructor(source, tech, options) {
    super(tech, options.vhs); // if a tech level `initialBandwidth` option was passed
    // use that over the VHS level `bandwidth` option

    if (typeof options.initialBandwidth === 'number') {
      this.options_.bandwidth = options.initialBandwidth;
    }

    this.logger_ = logger('VhsHandler'); // we need access to the player in some cases,
    // so, get it from Video.js via the `playerId`

    if (tech.options_ && tech.options_.playerId) {
      const _player = videojs.getPlayer(tech.options_.playerId);

      this.player_ = _player;
    }

    this.tech_ = tech;
    this.source_ = source;
    this.stats = {};
    this.ignoreNextSeekingEvent_ = false;
    this.setOptions_();

    if (this.options_.overrideNative && tech.overrideNativeAudioTracks && tech.overrideNativeVideoTracks) {
      tech.overrideNativeAudioTracks(true);
      tech.overrideNativeVideoTracks(true);
    } else if (this.options_.overrideNative && (tech.featuresNativeVideoTracks || tech.featuresNativeAudioTracks)) {
      // overriding native VHS only works if audio tracks have been emulated
      // error early if we're misconfigured
      throw new Error('Overriding native VHS requires emulated tracks. ' + 'See https://git.io/vMpjB');
    } // listen for fullscreenchange events for this player so that we
    // can adjust our quality selection quickly


    this.on(document, ['fullscreenchange', 'webkitfullscreenchange', 'mozfullscreenchange', 'MSFullscreenChange'], event => {
      const fullscreenElement = document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement;

      if (fullscreenElement && fullscreenElement.contains(this.tech_.el())) {
        this.playlistController_.fastQualityChange_();
      } else {
        // When leaving fullscreen, since the in page pixel dimensions should be smaller
        // than full screen, see if there should be a rendition switch down to preserve
        // bandwidth.
        this.playlistController_.checkABR_();
      }
    });
    this.on(this.tech_, 'seeking', function () {
      if (this.ignoreNextSeekingEvent_) {
        this.ignoreNextSeekingEvent_ = false;
        return;
      }

      this.setCurrentTime(this.tech_.currentTime());
    });
    this.on(this.tech_, 'error', function () {
      // verify that the error was real and we are loaded
      // enough to have pc loaded.
      if (this.tech_.error() && this.playlistController_) {
        this.playlistController_.pauseLoading();
      }
    });
    this.on(this.tech_, 'play', this.play);
  }
  /**
   * Set VHS options based on options from configuration, as well as partial
   * options to be passed at a later time.
   *
   * @param {Object} options A partial chunk of config options
   */


  setOptions_(options = {}) {
    this.options_ = merge(this.options_, options); // defaults

    this.options_.withCredentials = this.options_.withCredentials || false;
    this.options_.limitRenditionByPlayerDimensions = this.options_.limitRenditionByPlayerDimensions === false ? false : true;
    this.options_.useDevicePixelRatio = this.options_.useDevicePixelRatio || false;
    this.options_.useBandwidthFromLocalStorage = typeof this.source_.useBandwidthFromLocalStorage !== 'undefined' ? this.source_.useBandwidthFromLocalStorage : this.options_.useBandwidthFromLocalStorage || false;
    this.options_.useForcedSubtitles = this.options_.useForcedSubtitles || false;
    this.options_.useNetworkInformationApi = this.options_.useNetworkInformationApi || false;
    this.options_.useDtsForTimestampOffset = this.options_.useDtsForTimestampOffset || false;
    this.options_.customTagParsers = this.options_.customTagParsers || [];
    this.options_.customTagMappers = this.options_.customTagMappers || [];
    this.options_.cacheEncryptionKeys = this.options_.cacheEncryptionKeys || false;
    this.options_.llhls = this.options_.llhls === false ? false : true;
    this.options_.bufferBasedABR = this.options_.bufferBasedABR || false;

    if (typeof this.options_.playlistExclusionDuration !== 'number') {
      this.options_.playlistExclusionDuration = 60;
    }

    if (typeof this.options_.bandwidth !== 'number') {
      if (this.options_.useBandwidthFromLocalStorage) {
        const storedObject = getVhsLocalStorage();

        if (storedObject && storedObject.bandwidth) {
          this.options_.bandwidth = storedObject.bandwidth;
          this.tech_.trigger({
            type: 'usage',
            name: 'vhs-bandwidth-from-local-storage'
          });
        }

        if (storedObject && storedObject.throughput) {
          this.options_.throughput = storedObject.throughput;
          this.tech_.trigger({
            type: 'usage',
            name: 'vhs-throughput-from-local-storage'
          });
        }
      }
    } // if bandwidth was not set by options or pulled from local storage, start playlist
    // selection at a reasonable bandwidth


    if (typeof this.options_.bandwidth !== 'number') {
      this.options_.bandwidth = Config.INITIAL_BANDWIDTH;
    } // If the bandwidth number is unchanged from the initial setting
    // then this takes precedence over the enableLowInitialPlaylist option


    this.options_.enableLowInitialPlaylist = this.options_.enableLowInitialPlaylist && this.options_.bandwidth === Config.INITIAL_BANDWIDTH; // grab options passed to player.src

    ['withCredentials', 'useDevicePixelRatio', 'limitRenditionByPlayerDimensions', 'bandwidth', 'customTagParsers', 'customTagMappers', 'cacheEncryptionKeys', 'playlistSelector', 'initialPlaylistSelector', 'bufferBasedABR', 'liveRangeSafeTimeDelta', 'llhls', 'useForcedSubtitles', 'useNetworkInformationApi', 'useDtsForTimestampOffset', 'exactManifestTimings', 'leastPixelDiffSelector'].forEach(option => {
      if (typeof this.source_[option] !== 'undefined') {
        this.options_[option] = this.source_[option];
      }
    });
    this.limitRenditionByPlayerDimensions = this.options_.limitRenditionByPlayerDimensions;
    this.useDevicePixelRatio = this.options_.useDevicePixelRatio;
  } // alias for public method to set options


  setOptions(options = {}) {
    this.setOptions_(options);
  }
  /**
   * called when player.src gets called, handle a new source
   *
   * @param {Object} src the source object to handle
   */


  src(src, type) {
    // do nothing if the src is falsey
    if (!src) {
      return;
    }

    this.setOptions_(); // add main playlist controller options

    this.options_.src = expandDataUri(this.source_.src);
    this.options_.tech = this.tech_;
    this.options_.externVhs = Vhs;
    this.options_.sourceType = simpleTypeFromSourceType(type); // Whenever we seek internally, we should update the tech

    this.options_.seekTo = time => {
      this.tech_.setCurrentTime(time);
    };

    this.playlistController_ = new PlaylistController(this.options_);
    const playbackWatcherOptions = merge({
      liveRangeSafeTimeDelta: SAFE_TIME_DELTA
    }, this.options_, {
      seekable: () => this.seekable(),
      media: () => this.playlistController_.media(),
      playlistController: this.playlistController_
    });
    this.playbackWatcher_ = new PlaybackWatcher(playbackWatcherOptions);
    this.playlistController_.on('error', () => {
      const player = videojs.players[this.tech_.options_.playerId];
      let error = this.playlistController_.error;

      if (typeof error === 'object' && !error.code) {
        error.code = 3;
      } else if (typeof error === 'string') {
        error = {
          message: error,
          code: 3
        };
      }

      player.error(error);
    });
    const defaultSelector = this.options_.bufferBasedABR ? Vhs.movingAverageBandwidthSelector(0.55) : Vhs.STANDARD_PLAYLIST_SELECTOR; // `this` in selectPlaylist should be the VhsHandler for backwards
    // compatibility with < v2

    this.playlistController_.selectPlaylist = this.selectPlaylist ? this.selectPlaylist.bind(this) : defaultSelector.bind(this);
    this.playlistController_.selectInitialPlaylist = Vhs.INITIAL_PLAYLIST_SELECTOR.bind(this); // re-expose some internal objects for backwards compatibility with < v2

    this.playlists = this.playlistController_.mainPlaylistLoader_;
    this.mediaSource = this.playlistController_.mediaSource; // Proxy assignment of some properties to the main playlist
    // controller. Using a custom property for backwards compatibility
    // with < v2

    Object.defineProperties(this, {
      selectPlaylist: {
        get() {
          return this.playlistController_.selectPlaylist;
        },

        set(selectPlaylist) {
          this.playlistController_.selectPlaylist = selectPlaylist.bind(this);
        }

      },
      throughput: {
        get() {
          return this.playlistController_.mainSegmentLoader_.throughput.rate;
        },

        set(throughput) {
          this.playlistController_.mainSegmentLoader_.throughput.rate = throughput; // By setting `count` to 1 the throughput value becomes the starting value
          // for the cumulative average

          this.playlistController_.mainSegmentLoader_.throughput.count = 1;
        }

      },
      bandwidth: {
        get() {
          let playerBandwidthEst = this.playlistController_.mainSegmentLoader_.bandwidth;
          const networkInformation = window$1.navigator.connection || window$1.navigator.mozConnection || window$1.navigator.webkitConnection;
          const tenMbpsAsBitsPerSecond = 10e6;

          if (this.options_.useNetworkInformationApi && networkInformation) {
            // downlink returns Mbps
            // https://developer.mozilla.org/en-US/docs/Web/API/NetworkInformation/downlink
            const networkInfoBandwidthEstBitsPerSec = networkInformation.downlink * 1000 * 1000; // downlink maxes out at 10 Mbps. In the event that both networkInformationApi and the player
            // estimate a bandwidth greater than 10 Mbps, use the larger of the two estimates to ensure that
            // high quality streams are not filtered out.

            if (networkInfoBandwidthEstBitsPerSec >= tenMbpsAsBitsPerSecond && playerBandwidthEst >= tenMbpsAsBitsPerSecond) {
              playerBandwidthEst = Math.max(playerBandwidthEst, networkInfoBandwidthEstBitsPerSec);
            } else {
              playerBandwidthEst = networkInfoBandwidthEstBitsPerSec;
            }
          }

          return playerBandwidthEst;
        },

        set(bandwidth) {
          this.playlistController_.mainSegmentLoader_.bandwidth = bandwidth; // setting the bandwidth manually resets the throughput counter
          // `count` is set to zero that current value of `rate` isn't included
          // in the cumulative average

          this.playlistController_.mainSegmentLoader_.throughput = {
            rate: 0,
            count: 0
          };
        }

      },

      /**
       * `systemBandwidth` is a combination of two serial processes bit-rates. The first
       * is the network bitrate provided by `bandwidth` and the second is the bitrate of
       * the entire process after that - decryption, transmuxing, and appending - provided
       * by `throughput`.
       *
       * Since the two process are serial, the overall system bandwidth is given by:
       *   sysBandwidth = 1 / (1 / bandwidth + 1 / throughput)
       */
      systemBandwidth: {
        get() {
          const invBandwidth = 1 / (this.bandwidth || 1);
          let invThroughput;

          if (this.throughput > 0) {
            invThroughput = 1 / this.throughput;
          } else {
            invThroughput = 0;
          }

          const systemBitrate = Math.floor(1 / (invBandwidth + invThroughput));
          return systemBitrate;
        },

        set() {
          videojs.log.error('The "systemBandwidth" property is read-only');
        }

      }
    });

    if (this.options_.bandwidth) {
      this.bandwidth = this.options_.bandwidth;
    }

    if (this.options_.throughput) {
      this.throughput = this.options_.throughput;
    }

    Object.defineProperties(this.stats, {
      bandwidth: {
        get: () => this.bandwidth || 0,
        enumerable: true
      },
      mediaRequests: {
        get: () => this.playlistController_.mediaRequests_() || 0,
        enumerable: true
      },
      mediaRequestsAborted: {
        get: () => this.playlistController_.mediaRequestsAborted_() || 0,
        enumerable: true
      },
      mediaRequestsTimedout: {
        get: () => this.playlistController_.mediaRequestsTimedout_() || 0,
        enumerable: true
      },
      mediaRequestsErrored: {
        get: () => this.playlistController_.mediaRequestsErrored_() || 0,
        enumerable: true
      },
      mediaTransferDuration: {
        get: () => this.playlistController_.mediaTransferDuration_() || 0,
        enumerable: true
      },
      mediaBytesTransferred: {
        get: () => this.playlistController_.mediaBytesTransferred_() || 0,
        enumerable: true
      },
      mediaSecondsLoaded: {
        get: () => this.playlistController_.mediaSecondsLoaded_() || 0,
        enumerable: true
      },
      mediaAppends: {
        get: () => this.playlistController_.mediaAppends_() || 0,
        enumerable: true
      },
      mainAppendsToLoadedData: {
        get: () => this.playlistController_.mainAppendsToLoadedData_() || 0,
        enumerable: true
      },
      audioAppendsToLoadedData: {
        get: () => this.playlistController_.audioAppendsToLoadedData_() || 0,
        enumerable: true
      },
      appendsToLoadedData: {
        get: () => this.playlistController_.appendsToLoadedData_() || 0,
        enumerable: true
      },
      timeToLoadedData: {
        get: () => this.playlistController_.timeToLoadedData_() || 0,
        enumerable: true
      },
      buffered: {
        get: () => timeRangesToArray(this.tech_.buffered()),
        enumerable: true
      },
      currentTime: {
        get: () => this.tech_.currentTime(),
        enumerable: true
      },
      currentSource: {
        get: () => this.tech_.currentSource_,
        enumerable: true
      },
      currentTech: {
        get: () => this.tech_.name_,
        enumerable: true
      },
      duration: {
        get: () => this.tech_.duration(),
        enumerable: true
      },
      main: {
        get: () => this.playlists.main,
        enumerable: true
      },
      playerDimensions: {
        get: () => this.tech_.currentDimensions(),
        enumerable: true
      },
      seekable: {
        get: () => timeRangesToArray(this.tech_.seekable()),
        enumerable: true
      },
      timestamp: {
        get: () => Date.now(),
        enumerable: true
      },
      videoPlaybackQuality: {
        get: () => this.tech_.getVideoPlaybackQuality(),
        enumerable: true
      }
    });
    this.tech_.one('canplay', this.playlistController_.setupFirstPlay.bind(this.playlistController_));
    this.tech_.on('bandwidthupdate', () => {
      if (this.options_.useBandwidthFromLocalStorage) {
        updateVhsLocalStorage({
          bandwidth: this.bandwidth,
          throughput: Math.round(this.throughput)
        });
      }
    });
    this.playlistController_.on('selectedinitialmedia', () => {
      // Add the manual rendition mix-in to VhsHandler
      renditionSelectionMixin(this);
    });
    this.playlistController_.sourceUpdater_.on('createdsourcebuffers', () => {
      this.setupEme_();
    }); // the bandwidth of the primary segment loader is our best
    // estimate of overall bandwidth

    this.on(this.playlistController_, 'progress', function () {
      this.tech_.trigger('progress');
    }); // In the live case, we need to ignore the very first `seeking` event since
    // that will be the result of the seek-to-live behavior

    this.on(this.playlistController_, 'firstplay', function () {
      this.ignoreNextSeekingEvent_ = true;
    });
    this.setupQualityLevels_(); // do nothing if the tech has been disposed already
    // this can occur if someone sets the src in player.ready(), for instance

    if (!this.tech_.el()) {
      return;
    }

    this.mediaSourceUrl_ = window$1.URL.createObjectURL(this.playlistController_.mediaSource);
    this.tech_.src(this.mediaSourceUrl_);
  }

  createKeySessions_() {
    const audioPlaylistLoader = this.playlistController_.mediaTypes_.AUDIO.activePlaylistLoader;
    this.logger_('waiting for EME key session creation');
    waitForKeySessionCreation({
      player: this.player_,
      sourceKeySystems: this.source_.keySystems,
      audioMedia: audioPlaylistLoader && audioPlaylistLoader.media(),
      mainPlaylists: this.playlists.main.playlists
    }).then(() => {
      this.logger_('created EME key session');
      this.playlistController_.sourceUpdater_.initializedEme();
    }).catch(err => {
      this.logger_('error while creating EME key session', err);
      this.player_.error({
        message: 'Failed to initialize media keys for EME',
        code: 3
      });
    });
  }

  handleWaitingForKey_() {
    // If waitingforkey is fired, it's possible that the data that's necessary to retrieve
    // the key is in the manifest. While this should've happened on initial source load, it
    // may happen again in live streams where the keys change, and the manifest info
    // reflects the update.
    //
    // Because videojs-contrib-eme compares the PSSH data we send to that of PSSH data it's
    // already requested keys for, we don't have to worry about this generating extraneous
    // requests.
    this.logger_('waitingforkey fired, attempting to create any new key sessions');
    this.createKeySessions_();
  }
  /**
   * If necessary and EME is available, sets up EME options and waits for key session
   * creation.
   *
   * This function also updates the source updater so taht it can be used, as for some
   * browsers, EME must be configured before content is appended (if appending unencrypted
   * content before encrypted content).
   */


  setupEme_() {
    const audioPlaylistLoader = this.playlistController_.mediaTypes_.AUDIO.activePlaylistLoader;
    const didSetupEmeOptions = setupEmeOptions({
      player: this.player_,
      sourceKeySystems: this.source_.keySystems,
      media: this.playlists.media(),
      audioMedia: audioPlaylistLoader && audioPlaylistLoader.media()
    });
    this.player_.tech_.on('keystatuschange', e => {
      this.playlistController_.updatePlaylistByKeyStatus(e.keyId, e.status);
    });
    this.handleWaitingForKey_ = this.handleWaitingForKey_.bind(this);
    this.player_.tech_.on('waitingforkey', this.handleWaitingForKey_);

    if (!didSetupEmeOptions) {
      // If EME options were not set up, we've done all we could to initialize EME.
      this.playlistController_.sourceUpdater_.initializedEme();
      return;
    }

    this.createKeySessions_();
  }
  /**
   * Initializes the quality levels and sets listeners to update them.
   *
   * @method setupQualityLevels_
   * @private
   */


  setupQualityLevels_() {
    const player = videojs.players[this.tech_.options_.playerId]; // if there isn't a player or there isn't a qualityLevels plugin
    // or qualityLevels_ listeners have already been setup, do nothing.

    if (!player || !player.qualityLevels || this.qualityLevels_) {
      return;
    }

    this.qualityLevels_ = player.qualityLevels();
    this.playlistController_.on('selectedinitialmedia', () => {
      handleVhsLoadedMetadata(this.qualityLevels_, this);
    });
    this.playlists.on('mediachange', () => {
      handleVhsMediaChange(this.qualityLevels_, this.playlists);
    });
  }
  /**
   * return the version
   */


  static version() {
    return {
      '@videojs/http-streaming': version$4,
      'mux.js': version$3,
      'mpd-parser': version$2,
      'm3u8-parser': version$1,
      'aes-decrypter': version
    };
  }
  /**
   * return the version
   */


  version() {
    return this.constructor.version();
  }

  canChangeType() {
    return SourceUpdater.canChangeType();
  }
  /**
   * Begin playing the video.
   */


  play() {
    this.playlistController_.play();
  }
  /**
   * a wrapper around the function in PlaylistController
   */


  setCurrentTime(currentTime) {
    this.playlistController_.setCurrentTime(currentTime);
  }
  /**
   * a wrapper around the function in PlaylistController
   */


  duration() {
    return this.playlistController_.duration();
  }
  /**
   * a wrapper around the function in PlaylistController
   */


  seekable() {
    return this.playlistController_.seekable();
  }
  /**
   * Abort all outstanding work and cleanup.
   */


  dispose() {
    if (this.playbackWatcher_) {
      this.playbackWatcher_.dispose();
    }

    if (this.playlistController_) {
      this.playlistController_.dispose();
    }

    if (this.qualityLevels_) {
      this.qualityLevels_.dispose();
    }

    if (this.tech_ && this.tech_.vhs) {
      delete this.tech_.vhs;
    }

    if (this.mediaSourceUrl_ && window$1.URL.revokeObjectURL) {
      window$1.URL.revokeObjectURL(this.mediaSourceUrl_);
      this.mediaSourceUrl_ = null;
    }

    if (this.tech_) {
      this.tech_.off('waitingforkey', this.handleWaitingForKey_);
    }

    super.dispose();
  }

  convertToProgramTime(time, callback) {
    return getProgramTime({
      playlist: this.playlistController_.media(),
      time,
      callback
    });
  } // the player must be playing before calling this


  seekToProgramTime(programTime, callback, pauseAfterSeek = true, retryCount = 2) {
    return seekToProgramTime({
      programTime,
      playlist: this.playlistController_.media(),
      retryCount,
      pauseAfterSeek,
      seekTo: this.options_.seekTo,
      tech: this.options_.tech,
      callback
    });
  }
  /**
   * Adds the onRequest, onResponse, offRequest and offResponse functions
   * to the VhsHandler xhr Object.
   */


  setupXhrHooks_() {
    /**
     * A player function for setting an onRequest hook
     *
     * @param {function} callback for request modifiction
     */
    this.xhr.onRequest = callback => {
      addOnRequestHook(this.xhr, callback);
    };
    /**
     * A player function for setting an onResponse hook
     *
     * @param {callback} callback for response data retrieval
     */


    this.xhr.onResponse = callback => {
      addOnResponseHook(this.xhr, callback);
    };
    /**
     * Deletes a player onRequest callback if it exists
     *
     * @param {function} callback to delete from the player set
     */


    this.xhr.offRequest = callback => {
      removeOnRequestHook(this.xhr, callback);
    };
    /**
     * Deletes a player onResponse callback if it exists
     *
     * @param {function} callback to delete from the player set
     */


    this.xhr.offResponse = callback => {
      removeOnResponseHook(this.xhr, callback);
    }; // Trigger an event on the player to notify the user that vhs is ready to set xhr hooks.
    // This allows hooks to be set before the source is set to vhs when handleSource is called.


    this.player_.trigger('xhr-hooks-ready');
  }

}
/**
 * The Source Handler object, which informs video.js what additional
 * MIME types are supported and sets up playback. It is registered
 * automatically to the appropriate tech based on the capabilities of
 * the browser it is running in. It is not necessary to use or modify
 * this object in normal usage.
 */


const VhsSourceHandler = {
  name: 'videojs-http-streaming',
  VERSION: version$4,

  canHandleSource(srcObj, options = {}) {
    const localOptions = merge(videojs.options, options);
    return VhsSourceHandler.canPlayType(srcObj.type, localOptions);
  },

  handleSource(source, tech, options = {}) {
    const localOptions = merge(videojs.options, options);
    tech.vhs = new VhsHandler(source, tech, localOptions);
    tech.vhs.xhr = xhrFactory();
    tech.vhs.setupXhrHooks_();
    tech.vhs.src(source.src, source.type);
    return tech.vhs;
  },

  canPlayType(type, options) {
    const simpleType = simpleTypeFromSourceType(type);

    if (!simpleType) {
      return '';
    }

    const overrideNative = VhsSourceHandler.getOverrideNative(options);
    const supportsTypeNatively = Vhs.supportsTypeNatively(simpleType);
    const canUseMsePlayback = !supportsTypeNatively || overrideNative;
    return canUseMsePlayback ? 'maybe' : '';
  },

  getOverrideNative(options = {}) {
    const {
      vhs = {}
    } = options;
    const defaultOverrideNative = !(videojs.browser.IS_ANY_SAFARI || videojs.browser.IS_IOS);
    const {
      overrideNative = defaultOverrideNative
    } = vhs;
    return overrideNative;
  }

};
/**
 * Check to see if the native MediaSource object exists and supports
 * an MP4 container with both H.264 video and AAC-LC audio.
 *
 * @return {boolean} if  native media sources are supported
 */

const supportsNativeMediaSources = () => {
  return browserSupportsCodec('avc1.4d400d,mp4a.40.2');
}; // register source handlers with the appropriate techs


if (supportsNativeMediaSources()) {
  videojs.getTech('Html5').registerSourceHandler(VhsSourceHandler, 0);
}

videojs.VhsHandler = VhsHandler;
videojs.VhsSourceHandler = VhsSourceHandler;
videojs.Vhs = Vhs;

if (!videojs.use) {
  videojs.registerComponent('Vhs', Vhs);
}

videojs.options.vhs = videojs.options.vhs || {};

if (!videojs.getPlugin || !videojs.getPlugin('reloadSourceOnError')) {
  videojs.registerPlugin('reloadSourceOnError', reloadSourceOnError);
}

export { LOCAL_STORAGE_KEY, Vhs, VhsHandler, VhsSourceHandler, emeKeySystems, expandDataUri, getAllPsshKeySystemsOptions, setupEmeOptions, waitForKeySessionCreation };

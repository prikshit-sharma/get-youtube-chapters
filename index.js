/**
 * Make a chapter parser. Looks for the `startRx`, and then matches one chapter per line until an empty or non-chapter line.
 *
 * @param {RegExp} startRx - A regular expression matching the start of a chapter list. This does not have to contain any capture groups.
 * @param {RegExp} lineRx - A regular expression to match each chapter line. This should have four capture groups, in two sections:
 *   The timestamp:
 *   - hours
 *   - minutes
 *   - seconds
 *
 *   The title:
 *   - text
 *
 * @param {number} timestampIndex - The index of the start of the timestamp capture group.
 * @param {number} textIndex - The index of the text capture group.
 */
function makeChapterParser (startRx, lineRx, timestampIndex, textIndex) {
  // The first match element is the input, which will never be either the full timestamp or full title
  timestampIndex += 1
  textIndex += 1

  return function (description) {
    const chapters = [] // Initialize an empty array to store the chapters
    const nonEmptyLines = skipEmptyLines(description) // Remove empty lines from the description
    const firstTimestamp = nonEmptyLines.findIndex((line) => startRx.test(line)) // Find the first line containing a timestamp

    if (firstTimestamp === -1) { // If no timestamp is found, return an empty array
      return chapters
    }

    const chapterLines = nonEmptyLines.slice(firstTimestamp) // Extract lines starting from the first timestamp
    for (let i = 0; i < chapterLines.length; i += 1) { // Loop through each line after the first timestamp
      const line = chapterLines[i]
      const match = lineRx.exec(line) // Match the line against the provided regex
      if (!match) {
        continue // If no match is found, skip the current line
      }

      // Parse the timestamp and title from the line
      const { timestamp, title } = parseFlexibleTimestamps(line)

      // Add the parsed chapter to the chapters array
      chapters.push({
        start: timestamp, // The start time of the chapter in seconds
        title: title.trim() // The title of the chapter, with any surrounding whitespace removed
      })
    }

    return chapters // Return the array of parsed chapters
  }
}

/**
 * Parses timestamps from a line of text, handling various formats such as `HH:MM:SS`, `[HH:MM:SS]`, or `(HH:MM:SS)`.
 *
 * @param {string} line - The line of text potentially containing a timestamp and title.
 * @returns {object} - An object containing the parsed timestamp in seconds and title text.
 */
function parseFlexibleTimestamps (line) {
  // Regex to capture timestamps in formats like [HH:MM:SS], (HH:MM:SS), and HH:MM:SS
  const timestampRegex = /(?:\[\s*(?:(\d+):)?(\d+):(\d+)\s*\]|\(\s*(?:(\d+):)?(\d+):(\d+)\s*\)|(?:(\d+):)?(\d+):(\d+))/
  const match = timestampRegex.exec(line) // Execute the regex to find the timestamp

  if (!match) {
    return { timestamp: 0, title: line } // If no match, default to 0 for timestamp and return the full line as the title
  }

  // Parse hours, minutes, and seconds from the matched groups, using '0' as a fallback if the component is missing
  const hours = parseInt(match[1] || match[4] || match[7] || '0', 10)
  const minutes = parseInt(match[2] || match[5] || match[8] || '0', 10)
  const seconds = parseInt(match[3] || match[6] || match[9] || '0', 10)
  const timestamp = hours * 3600 + minutes * 60 + seconds // Convert the time into seconds

  // Remove the timestamp from the line to extract the title
  const title = line.replace(timestampRegex, '').replace(/^\d+\.\s*/, '').trim()

  return { timestamp, title } // Return the parsed timestamp in seconds and the chapter title
}

/**
 * Splits the input description by line breaks and filters out empty lines.
 *
 * @param {string} description - The input chapter description.
 * @returns {string[]} - An array of non-empty lines from the description.
 */
function skipEmptyLines (description) {
  return description.split('\n').filter((line) => line.trim() !== '') // Split by newlines and filter out empty lines
}

/**
 * Adds the `/m` regex flag if it isn't already present.
 *
 * @param {RegExp} regex
 * @returns {RegExp}
 */
function addM (regex) {
  if (regex.flags.indexOf('m') === -1) {
    return new RegExp(regex.source, regex.flags + 'm')
  }
  return regex
}

// $timestamp $title
const lawfulParser = makeChapterParser(/^0?0:00/m, /^(?:(\d+):)?(\d+):(\d+)\s+(.*?)$/, 0, 3)
// [$timestamp] $title
const bracketsParser = makeChapterParser(/^\[(?:0?0:00|00:00)\]/, /^\[(?:(\d+):)?(\d+):(\d+)\]\s+(.*?)$/, 0, 3)
// ($timestamp) $title
const parensParser = makeChapterParser(/^\(0?0:00\)/m, /^\((?:(\d+):)?(\d+):(\d+)\)\s+(.*?)$/, 0, 3)
// ($track_id.) $title $timestamp
const postfixRx = /^(?:\d+\.\s+)?(.*?)\s+(?:(\d+):)?(\d+):(\d+)$/
const postfixParser = makeChapterParser(addM(postfixRx), postfixRx, 1, 0)
// ($track_id.) $title ($timestamp)
const postfixParenRx = /^(?:\d+\.\s+)?(.*?)\s+\(\s*(?:(\d+):)?(\d+):(\d+)\s*\)$/
const postfixParenParser = makeChapterParser(addM(postfixParenRx), postfixParenRx, 1, 0)
// $track_id. $timestamp $title
const prefixRx = /^(?:\d+\.\s+)?(?:(\d+):)?(\d+):(\d+)\s+(.*)$/
const prefixParser = makeChapterParser(addM(prefixRx), prefixRx, 0, 3)

/**
 * Parses the YouTube chapter descriptions, matching one of the defined formats.
 *
 * @param {string} description - The YouTube video description containing chapter timestamps.
 * @returns {Array} - The parsed chapters as an array of objects with `start` and `title` properties.
 */
module.exports = function parseYouTubeChapters (description) {
  let chapters = lawfulParser(description)
  if (chapters.length === 0) chapters = bracketsParser(description)
  if (chapters.length === 0) chapters = parensParser(description)
  if (chapters.length === 0) chapters = postfixParser(description)
  if (chapters.length === 0) chapters = postfixParenParser(description)
  if (chapters.length === 0) chapters = prefixParser(description)

  return chapters
}

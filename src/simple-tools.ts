/* jshint node: true */
"use strict";

/**
 * Tokenizes a string
 * @param {string} text The text to be tokenized
 * @param {string} token The token to be used
 * @return {Array} The tokenized string.
 */
function tokenize(text: string, token: string) {
  return token.length > 0 ? text.split(token) : [ text ];
}

export { tokenize };

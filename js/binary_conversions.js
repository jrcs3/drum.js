/* 
 * Drum Machine Joy! - an HTML5 drum machine
 * Copyright (C) 2012 MacKenzie Cumings <mackenzie.cumings art gmail dort crom>
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * version 2 as published by the Free Software Foundation.
 * The full license is available at http://www.gnu.org/licenses/gpl.html
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 */

function byteSwap(uint16)
{
  return ( uint16 >> 8 ) | ( ( uint16 & 0xFF ) << 8 );
}

function convertToInt16(uint16)
{
  return uint16 & 0x8000 ? -(0x10000 - uint16) : uint16;
}

function convertToUInt16(int16)
{
  return int16 & 0xFFFF;
}

function convertTwoWordsToUInt32(twoWords)
{
  return (convertToUInt16(twoWords[1]) & 0xFFFF) | (convertToUInt16(twoWords[0]) << 16);
}

function convertUInt32ToTwoWords(uint32)
{
  return [ convertToInt16(uint32 & 0xFFFF), convertToInt16(uint32 >>> 16) ];
}

function emplaceUInt32(uint32,index,wordArray)
{
  var words = convertUInt32ToTwoWords(uint32);
  wordArray[index] = words[0];
  wordArray[index+1] = words[1];
}

function extractUInt32(index,wordArray)
{
  return convertTwoWordsToUInt32( [ wordArray[index], wordArray[index+1] ] );
}

//This code is copied from http://codebase.es/riffwave/riffwave.js...
var chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
var TwelveBitsToTwoChars = [];
var TwoCharsToTwelveBits = {};

// Initialize array encLookup so it contains the 2-character strings that correspond
// to each 12-bit number from 0 to 4095.
for (var i=0; i<4096; i++) {
  var pair = chars[i >> 6] + chars[i & 0x3F];
  TwelveBitsToTwoChars[i] = pair;
  TwoCharsToTwelveBits[pair] = i;
}
// ...End of code copied from http://codebase.es/riffwave/riffwave.js.

function ConstructNibblyConverter(
  sourceDataAccessor,
  nibblesPerSourceDatum,
  nibblesPerTargetDatum,
  targetDatumConverter )
{
  return {
    getSourceDatum: sourceDataAccessor,
    nibblesPerSourceDatum: nibblesPerSourceDatum,
    nibblesPerTargetDatum: nibblesPerTargetDatum,
    convertTargetDatum: targetDatumConverter,
    getNibble: function(offset)
    {
      return ( this.getSourceDatum(Math.floor(offset/this.nibblesPerSourceDatum))
               >> (4*(this.nibblesPerSourceDatum - 1 - (offset%this.nibblesPerSourceDatum)))
             ) & 0xF;
    },
    getNibbles: function(offset)
    {
      var nibbles = 0;
      var afterLastIndex = offset + this.nibblesPerTargetDatum;
      for ( var i = offset; i < afterLastIndex; i++ )
      {
        nibbles = ( nibbles << 4 ) | this.getNibble(i);
      }
      return nibbles;
    },
    getTargetDatum: function(offset)
    {
      return this.convertTargetDatum(this.getNibbles(this.nibblesPerTargetDatum*offset));
    }
  };
}

function ConstructBase64ToInt16Converter()
{
  var converter = ConstructNibblyConverter(
    function(offset)
    {
      return TwoCharsToTwelveBits[ this.data.substr( 2*offset, 2 ) ];
    },
    3,
    4,
    function(datum) { return convertToInt16(byteSwap(datum)); } );
  
  converter.convert = function(base64String)
  {
    this.data = base64String.substr( base64String.lastIndexOf( "," ) + 1 );
    var result = [];
    var wordsInData = Math.floor( 6 * this.data.length / 16 );
    for ( var i = 0; i < wordsInData; i++ )
    {
      result.push(this.getTargetDatum( i ));
    }
    return result;
  };
  
  return converter;
}

function ConstructInt16ToBase64Converter()
{
  var converter = ConstructNibblyConverter(
    function(offset)
    {
      return byteSwap(convertToUInt16(this.data[offset]));
    },
    4,
    3,
    function(datum)
    {
      return TwelveBitsToTwoChars[ datum ];
    } );
  
  converter.convert = function(int16Array)
  {
    this.data = int16Array;

    var result = "data:audio/wav;base64,";
    var characterPairsInData = Math.floor( 16 * this.data.length / 12 );
    for ( var i = 0; i < characterPairsInData; i++ )
    {
      result += this.getTargetDatum( i );
    }
    if ( characterPairsInData % 2 > 0 )
      result += "==";
    
    return result;
  };
  
  return converter;
}
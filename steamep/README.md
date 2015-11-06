# Userscript For Steam Exchange Point ([steamep.com](https://steamep.com/ "Steam Exchange Point"))

### Userscript what?

Userscripts works with [Greasemonkey](http://www.greasespot.net/ "Greasemonkey Website") ([Firefox] (https://addons.mozilla.org/firefox/addon/greasemonkey/ "Firefox Addon")) / [Tampermonkey](https://tampermonkey.net/ "Tampermonkey Website") ([Chrome](https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo "Chrome Addon"),[Opera](https://addons.opera.com/extensions/details/tampermonkey-beta/ "Opera Addon"),Safari and other) / [Violent Monkey](https://github.com/Violentmonkey/Violentmonkey "Violent Monkey  Website")  ([Opera](https://addons.opera.com/extensions/details/violent-monkey/ "Opera Addon"))

### Install:

[Open the link to install the Userscript](https://raw.githubusercontent.com/cnleo/userscripts/master/steamep/steamep-userscript.user.js "https://raw.githubusercontent.com/cnleo/userscripts/master/steamep/steamep-userscript.user.js")

### What it does on steamep.com:

 *	[0.0]: Yellow hint of "false" duplicated Items they comes from old "ampersand" bug on SteamEP (not finally all discovered)
 *	[0.1]: Remove "Have"/"Need" on "false" duplicates -button
 *	[0.2]: Append Game Title under Game Banner (OBSOLETE already implemented from steamep.com)
 *	[0.3]: Set "Have" on all Items you have twice or more -button
 *	[0.4]: Set "Need" on all Items in the same game-set if already one or more HAVE's in there (occurring due to a multiple) -button
 *	[0.5]: Remove all "Need" -button
 *	[0.6]: Remove all "Have" -button
 *	[0.7]: Append "inventory marker" (blue dots) and quantity of duplicates on items in other lists
 *	[0.8]: Counting on items for nice overview and "haptic"
 
### To be observed:

 *	After installing your first visit should be https://steamep.com/list/inventory 
The Userscript will load the information from it, and every time you visit the url, it will be updating the information to use it on the other lists like /list/2 or /list/selected.

### To do:

 *	Counting on items that you can "modify" are fuzzy at moment.





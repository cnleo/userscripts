// ==UserScript==
// @name        Userscript For Steam Exchange Point (steamep.com)

// @description	Expand user experience on steamep.com and fix a small bug (hopefully).

// @downloadURL	https://raw.githubusercontent.com/cnleo/userscripts/steamep/steamep-userscript.user.js
// @updateURL	https://raw.githubusercontent.com/cnleo/userscripts/steamep/steamep-userscript.meta.js

// @author		cnleo

// @namespace	cnleo/userscripts

// @grant       GM_getValue
// @grant       GM_setValue

// @match	https://steamep.com/*
// @match	http://steamep.com/*

// @version	0.5.0

// @run-at document-start
// ==/UserScript==



/** DESCRIPTION:
 *
 *	[0.0]: Remove (or yellow hint of) duplicated Items they comes from old ampersand bug in SteamEP (not finally all discovered)
 *	[0.1]: OBSOLETE: Append Game Title under Game Banner (already implemented from steamep.com)
 *	[0.2]: Set "Have" on Items thus are multiple exist
 *	[0.3]: Set "Need" on Items in same game set, where already is set one ore more "Have" that comes from a duplicate
 *	[0.4]: Append "inventory" marker (blue dots) and numbers of multiple duplicates like "(2)" on items in other list, not only on "Inventory"
 *	[0.5]: TODO (currently fuzzy): Counting on items for nice overview and "haptic"
 *
**/



// HELPERS
function hasClass(ele, cls) {
	var test = document.createElement('_');
	if ( !('classList' in test) ) {
		return (' ' + ele.className + ' ').indexOf(' ' + cls + ' ') > -1;
	} else {
		return ele.classList.contains(cls);
	}
}

var XhtMLentity = (function () { //for utf8 pages it is not so important but it makes your life easier, sometimes

	var entities = [ // NOT USED BUT NICE OVERVIEW
		// entity, 		unicode, 	hexadecimal,unicode css,	unicode hex,	number decimal,	js-escaped symbol
		// xhtml js, 	js, 		js,			css(content),	xhtml,			xhtml, 			xhtml(utf8,not js-escaped) js
		//(xhtml not in attributes)
		
		['&apos;', 		'\u0027', 	'\x27', 	'\0027',		'&#x27;', 		'&#39;', 		'\''], // <-- this one (') is important for XML instead HTML but in HTML5 it is predefined too
		
		['&lt;', 		'\u003C', 	'\x3C', 	'\003C',		'&#x3C;', 		'&#60;', 		'<'],
		['&gt;', 		'\u003E', 	'\x3E', 	'\003E',		'&#x3E;', 		'&#62;', 		'>'],
		['&quot;', 		'\u0022', 	'\x22', 	'\0022',		'&#x22;', 		'&#34;', 		'\"'],
		['&amp;', 		'\u0026', 	'\x26', 	'\0026',		'&#x26;', 		'&#38;', 		'&']
		
	];
	
	var decode = function (str) {
		if(str && typeof str === 'string') {
			//var str = str.replace(/\'/g,'&apos;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\"/g,'&quot;').replace(/&(?![a-zA-Z]{2,7};)/g,'&amp;');
			str = str.replace(/\'/g,'&apos;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\"/g,'&quot;').replace(/&(?!([a-zA-Z]{2,7};|\#x[0-9a-fA-F]{2,4};|\#[0-9]{2,4};))/g,'&amp;');
			return str;
		} else {
			return '';
		}
	};
	
	var encode = function (str) {
		if(str && typeof str === 'string') {
			str = str.replace(/&apos;/g,'\'').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'\"').replace(/&amp;/g,'&');
			return str;
		} else {
			return '';
		}
	};
	
	return {
		decode: decode,
		encode: encode
	};
	
})();



// SOME GLOBALS
var gameItems = {};

var itemsCount = {
	'have':0,
	'need':0,
	'hasDuplicate':0,
	'inventory':0,
	'item':0, //<-- not used 
	'falseDuplicate':0, //<-- deprecate DO NOT USE
	'falseDuplicateWithHaveOrNeed':0,
	'falseDuplicateExist':0,
	'setNeed':0,
	'setHave':0,
	// follows includes falseDuplicate stuff:
	'duplicateWithoutHave':0, 
	'duplicateWithHave':0,
	'duplicateWithoutNeed':0,
	'duplicateWithNeed':0
	
};

// global variables to fire events on it
var ct_need,
ct_have,
ct_duplicate,
ct_remove_need,
ct_remove_have,
newRow;


/** appendGameTitles () // OBSOLETE already implement on steamep.com
 *
 *	Append the Title of a Game under the Game Banner for better search solution and overview (ctrl+f) 
 *	(Also sometimes you have no clue about the game name, not exactly. Mostly not important but nice to have/know)
 *
 *	* Search for "Alt" attribute in images for this value
 *	* Append the alt value on "game banner" as div
 *
**/ 

function appendGameTitles () {

	var gameBannerItems = document.querySelectorAll('div.game-banner');
	for ( var i = 0, leng = gameBannerItems.length; i < leng; i++ ) {
	
		var gameNameMaybe = gameBannerItems[i].getElementsByTagName('img')[0].getAttribute('alt');
		if (!!gameNameMaybe) {
			var gameNameDiv = document.createElement('div');
			var gameNameText = document.createTextNode(gameNameMaybe);
				gameNameDiv.appendChild(gameNameText);
				gameBannerItems[i].appendChild(gameNameDiv);
		}
	
	}
	
}

// Explanation not the easiest:

	// Set "Need" on Items in the same "game set", they already have a duplicate "Have" in there.
	// Set "Need" on Items in the same "game set", which already have a duplicate conditional "Have" in itself.
	// Set "Need" on all items in the same "game set", in which an item with a "Have" is already set. Applies only to items of the same kind, and the included "Have" is occurring due to a multiple. 
	
	//Setze "Need" auf Items im selben "Spiel-Set", welche bereits ein duplikat bedingtes "Have" in sich haben.
	//Setze "Need" auf alle Items im selben "Spiel-Set", in welchem bereits ein Item mit einem "Have" gesetzt ist. Betrifft nur Items der selben art, und das betreffene "Have" muss bedingt sein durch ein mehrfaches vorkommen des selben Items.
	

function setNeeds () {
	for (var index in gameItems) {
		if (gameItems.hasOwnProperty(index)) {
			var element = gameItems[index];
			if (!element.classList.contains("hasDuplicate") && 
				!element.classList.contains("have") &&
				!element.classList.contains("need") &&
				!element.classList.contains("inventory") &&
				!element.getAttribute('data-deprecated-duplicate') &&
				!!element.parentNode.querySelector('.hasDuplicate.have')	)
			{ 
				element.click();
				var setOption = element.querySelector('div.card-option div.need');
				if (!!setOption) {
					setOption.click();
				} else {
					var cancelOption = element.querySelector('div.card-option div.cancel');
					if (!!cancelOption) {
						cancelOption.click();
					}
				}
			}
		}
	}
}

function setHaves () {
	for (var index in gameItems) {
		if (gameItems.hasOwnProperty(index)) {
			var element = gameItems[index];
			if (element.classList.contains("hasDuplicate") &&
				!element.getAttribute('data-deprecated-duplicate') &&
				!element.classList.contains("have") &&
				!element.classList.contains("need")
				)
			{
				element.click();
				var setOption = element.querySelector('div.card-option div.have');
				if (!!setOption) {
					setOption.click();
				} else {
					var cancelOption = element.querySelector('div.card-option div.cancel');
					if (!!cancelOption) {
						cancelOption.click();
					}
				}
			}
		}
	}
}

function removeFalseDuplicates () {
	for (var index in gameItems) {
		if (gameItems.hasOwnProperty(index)) {
			var element = gameItems[index];
			if ( element.classList.contains("hasDuplicate") && element.getAttribute('data-deprecated-duplicate') &&
				(element.classList.contains("have") || element.classList.contains("need"))
			) { 
				element.click();
				var setOption = element.querySelector('div.card-option div.remove');
				if (!!setOption) {
					setOption.click();
				} else {
					var cancelOption = element.querySelector('div.card-option div.cancel');
					if (!!cancelOption) {
						cancelOption.click();
					}
				}
			}
		}
	}
}

function removeAllHaves () {
	for (var index in gameItems) {
		if (gameItems.hasOwnProperty(index)) {
		   var element = gameItems[index];
		   if ( element.classList.contains("have") ) {
				element.click();
				var setOption = element.querySelector('div.card-option div.remove');
				if (!!setOption) {
					setOption.click();
				} else {
					var cancelOption = element.querySelector('div.card-option div.cancel');
					if (!!cancelOption) {
						cancelOption.click();
					}
				}
			}
		}
	}
}

function removeAllNeeds () {
	for (var index in gameItems) {
		if (gameItems.hasOwnProperty(index)) {
		   var element = gameItems[index];
		   if ( element.classList.contains("need") ) {
				element.click();
				var setOption = element.querySelector('div.card-option div.remove');
				if (!!setOption) {
					setOption.click();
				} else {
					var cancelOption = element.querySelector('div.card-option div.cancel');
					if (!!cancelOption) {
						cancelOption.click();
					}
				}
			}
		}
	}
}

var invokeInterface = function () {

	var contentDiv = document.querySelector('div.content');
//	var contentDivChild = document.querySelector('div.content div.row:nth-of-type(3)');
	var contentDivChild = document.querySelector('div.content div.row');

	 newRow = document.createElement('div');
		newRow.addEventListener('goToInventory', function () {
			this.textContent = 'Please go to "Inventory" for Update Data';
		}, false);
		newRow.setAttribute('class','row');

	var bt = document.createElement('button');
	var ct = document.createElement('span');
		ct.setAttribute('class','counter');
		ct.textContent = 'n.A.';

	// SET NEED
	var bt_need = bt.cloneNode(true);
		bt_need.addEventListener('click', function () {
			setNeeds();
		}, false);
		bt_need.textContent = "set Need's ";
		bt_need.setAttribute('title',"Set NEED's on all Items in the same game-set if already one or more HAVE's in there (occurring due to a multiple).");
		//(without the game-set you already marked as complete [not-yet-implemented] will revoke all Need's on game-set's marked as complete)");
	 ct_need = ct.cloneNode(true);
		ct_need.textContent = '('+ itemsCount.setNeed +')';
		ct_need.addEventListener('counterViewUpdate', function () {
			this.textContent = '('+ itemsCount.setNeed +')';
		}, false);
		
		bt_need.appendChild(ct_need);
	
	// SET HAVE
	var bt_have = bt.cloneNode(true);
		bt_have.addEventListener('click', function () {
			setHaves();
		}, false);
		bt_have.textContent = "set Have's ";
		bt_have.setAttribute('title','Set \u0022Have\u0022 on all Items you have twice or more (in your Inventory).');
		// and will set Have on all Items on game-set's marked as complete where is only one item in inventory (left))
	 ct_have = ct.cloneNode(true);
		ct_have.textContent = '('+ itemsCount.setHave +')';
		ct_have.addEventListener('counterViewUpdate', function () {
			this.textContent = '('+ itemsCount.setHave +')';
		}, false);
		
		bt_have.appendChild(ct_have);
	
	// FALSE DUPLICATE
	var bt_duplicate = bt.cloneNode(true);
		bt_duplicate.addEventListener('click', function () {
			removeFalseDuplicates();
		}, false);
		bt_duplicate.textContent = "remove Have/Need on false duplicates (yellow items) ";
	 ct_duplicate = ct.cloneNode(true);
		ct_duplicate.textContent = '('+ itemsCount.falseDuplicateWithHaveOrNeed + '/'+ itemsCount.falseDuplicateExist + ')';
		ct_duplicate.addEventListener('counterViewUpdate', function () {
			this.textContent = '('+ itemsCount.falseDuplicateWithHaveOrNeed + '/'+ itemsCount.falseDuplicateExist + ')';
		}, false);

		bt_duplicate.appendChild(ct_duplicate);
	
	// REMOVE ALL NEED
	var bt_remove_need = bt.cloneNode(true);
		bt_remove_need.addEventListener('click', function () {
			removeAllNeeds();
		}, false);
		bt_remove_need.textContent = "remove all Need's ";
	 ct_remove_need = ct.cloneNode(true);
		ct_remove_need.textContent = '('+itemsCount.need+')';
		ct_remove_need.addEventListener('counterViewUpdate', function () {
			this.textContent = '('+itemsCount.need+')';
		}, false);
		
		bt_remove_need.appendChild(ct_remove_need);
	
	// REMOVE ALL HAVE
	var bt_remove_have = bt.cloneNode(true);
		bt_remove_have.addEventListener('click', function () {
			removeAllHaves();
		}, false);
		bt_remove_have.textContent = "remove all Have's ";
	 ct_remove_have = ct.cloneNode(true);
		ct_remove_have.textContent = '('+itemsCount.have+')';
		ct_remove_have.addEventListener('counterViewUpdate', function () {
			this.textContent = '('+itemsCount.have+')';
		}, false);
		
		bt_remove_have.appendChild(ct_remove_have);
		
		
		
	
	newRow.appendChild(bt_have);
	newRow.appendChild(bt_need);
	newRow.appendChild(bt_duplicate);
	newRow.appendChild(bt_remove_have);
	newRow.appendChild(bt_remove_need);
	
	
	//alert(location.pathname);
	if (location.pathname == "/list/inventory" || location.pathname == "/grunt-test/testcases") { //https://steamep.com/list/inventory
		contentDiv.insertBefore(newRow,contentDivChild);
		
	} else if  (location.pathname == "/list" || 
				location.pathname == "/list/selected" || 
				location.pathname == "/grunt-test/testcases" || 
				location.pathname == "/list/1" || 
				location.pathname == "/list/2" || 
				location.pathname == "/list/3" || 
				location.pathname == "/list/4" || 
				location.pathname == "/list/5"
				) 
	{
		contentDiv.insertBefore(newRow,contentDivChild);
		//newRow.textContent = 'For autosetup options please go to "Inventory"';
	}
	
}



document.addEventListener("DOMContentLoaded", function(event) {

	var event = new Event('counterViewUpdate');
	var eventGoToInv = new Event('goToInventory');

	// all for the counting
	var observer = new MutationObserver(function(mutations) {
		mutations.forEach(function(mutation) {
		
			//document.body.appendChild(document.createTextNode('type:' +mutation.type + ' attributeName:' + mutation.attributeName + ' attributeNamesace:' +  mutation.attributeNamespace + ' oldValue:' + mutation.oldValue + ' target:' + mutation.target + ' <br />\n '));

			var _oldClasslist = mutation.oldValue.replace(/\s+/g, ' ').trim().split(' ');
			var _newClasslist = mutation.target.classList.toString().replace(/\s+/g, ' ').trim().split(' ');
			
			//alert('old ' + _oldClasslist.length + ' ' + _oldClasslist);
			//alert('new ' + _newClasslist.length + ' ' + _newClasslist);
			

			if ( _newClasslist.indexOf('hasDuplicate') > -1 && _oldClasslist.indexOf('hasDuplicate') > -1 ) {
			
				if (_newClasslist.indexOf('have') > -1 && 
					_oldClasslist.indexOf('have') === -1)
				{
					itemsCount['duplicateWithoutHave']++;
					itemsCount['duplicateWithHave']--;
				} else if (_newClasslist.indexOf('have') === -1 && 
							_oldClasslist.indexOf('have') > -1)
				{
					itemsCount['duplicateWithoutHave']--;
					itemsCount['duplicateWithHave']++;
				}
				
				
				if (_newClasslist.indexOf('need') > -1 && 
					_oldClasslist.indexOf('need') === -1)
				{
					itemsCount['duplicateWithoutNeed']++;
					itemsCount['duplicateWithNeed']--;
				} else if (_newClasslist.indexOf('need') === -1 && 
							_oldClasslist.indexOf('need') > -1)
				{
					itemsCount['duplicateWithoutNeed']--;
					itemsCount['duplicateWithNeed']++;
				} 
				
				// check false duplicates
				if (!!mutation.target.getAttribute('data-deprecated-duplicate')) {
					if (_newClasslist.indexOf('have') === -1 && _oldClasslist.indexOf('have') === -1) {
						itemsCount['falseDuplicateWithHaveOrNeed']--;
					} else if (_newClasslist.indexOf('have') > -1 || _oldClasslist.indexOf('have') > -1) {
						itemsCount['falseDuplicateWithHaveOrNeed']++;
					}
					
					if ( (_newClasslist.indexOf('have') > -1 && _oldClasslist.indexOf('have') === -1) ||
						 (_newClasslist.indexOf('need') > -1 && _oldClasslist.indexOf('need') === -1) 
						){
						itemsCount['falseDuplicateWithHaveOrNeed']++;
					} else if	( (_newClasslist.indexOf('have') === -1 && _oldClasslist.indexOf('have') > -1) ||
								  (_newClasslist.indexOf('need') === -1 && _oldClasslist.indexOf('need') > -1) 
								){
						itemsCount['falseDuplicateWithHaveOrNeed']--;
					}
				}
				
			} // else { possible to remove hasDuplicate on the fly? }
			
			// setNeed removed or added
			/*
				we need a better performance?
			*/
			if ( _newClasslist.indexOf('hasDuplicate') === -1 && _oldClasslist.indexOf('hasDuplicate') === -1 && 
				_newClasslist.indexOf('inventory') === -1 && _oldClasslist.indexOf('inventory') === -1 &&
				_newClasslist.indexOf('have') === -1 &&
				!mutation.target.getAttribute('data-deprecated-duplicate') &&
				!!mutation.target.parentNode.querySelector('.hasDuplicate.have')
			) { 
				if ( _newClasslist.indexOf('need') === -1 && _oldClasslist.indexOf('need') > -1 ) {
					itemsCount['setNeed']--;
				} else if ( _newClasslist.indexOf('need') > -1 && _oldClasslist.indexOf('need') === -1 ) {
					itemsCount['setNeed']++;
				}
			}
			
			// setHave
			if ( _newClasslist.indexOf('hasDuplicate') > -1 && _oldClasslist.indexOf('hasDuplicate') > -1 && 
				//_newClasslist.indexOf('inventory') > -1 && _oldClasslist.indexOf('inventory') > -1 &&
				!mutation.target.getAttribute('data-deprecated-duplicate') 
				) 
			{ 
				if ( _newClasslist.indexOf('have') === -1 && _oldClasslist.indexOf('have') > -1 && _newClasslist.indexOf('need') === -1) {
					itemsCount['setHave']++;
				} else if ( _newClasslist.indexOf('have') > -1 && _oldClasslist.indexOf('have') === -1 ) {
					itemsCount['setHave']--;
				}
			}
			
			function checkAddClass (element, index, array) {
				if (_oldClasslist.indexOf(element) === -1) {
					//alert('Following Class added: ' + element);
					itemsCount[element]++;
				}
			}
			
			function checkRmvClass (element, index, array) {
				if (_newClasslist.indexOf(element) === -1) {
					//alert('Following Class removed: ' + element);
					itemsCount[element]--;
				}
			}
			
			if (_newClasslist.length > _oldClasslist.length) {
				// class add
				_newClasslist.forEach(checkAddClass);
			}
			if (_newClasslist.length < _oldClasslist.length) {
				// class rmv
				_oldClasslist.forEach(checkRmvClass);
			}
			
			/*
			_oldClasslist.forEach(checkRmvClass);
			_newClasslist.forEach(checkAddClass);
			_oldClasslist.forEach(checkAddClass);
			_newClasslist.forEach(checkRmvClass);
			*/
			
			//element.classList.contains("hasDuplicate") && !element.getAttribute('data-deprecated-duplicate') && !element.classList.contains("have") ) {

		});
		
		// trigger event 
		ct_need.dispatchEvent(event);
		ct_have.dispatchEvent(event);
		ct_duplicate.dispatchEvent(event);
		ct_remove_need.dispatchEvent(event);
		ct_remove_have.dispatchEvent(event);
		
		/*
		alert('Have:' +
			itemsCount.have + ' Need:' +
			itemsCount.need + ' Duplicate:' +
			itemsCount.hasDuplicate + ' Inventory:' +
			itemsCount.inventory + ' Item:' +
			itemsCount.item + ' False Duplicate:' +
			itemsCount.falseDuplicate + ' Duplicate with Need:' +
			itemsCount.duplicateWithNeed + ' Duplicate without Need:' +
			itemsCount.duplicateWithoutNeed + ' Duplicate with Have:' +
			itemsCount.duplicateWithHave + ' Duplicate without Have:' +
			itemsCount.duplicateWithoutHave
		);
		*/
	});

	var config = {
		attributes: true,
		childList: false,
		characterData: false,
		subtree: false,
		attributeOldValue: true,
		characterDataOldValue: false,
		attributeFilter: ['class']
	};

	// global variable
	gameItems = document.querySelectorAll('div.game-items div[data-item]');
	
	
	        

	// itemsCount and set observer on items AND save stats of items for other pages overview
	for (var i = 0, leng = gameItems.length; i < leng; i++) {
	
		if (location.pathname != '/list/inventory') {
			var getItemData = GM_getValue(gameItems[i].getAttribute('data-item'));
			//alert(getItemData); 
			if (!isNaN(parseFloat(getItemData)) && isFinite(getItemData)) {
				if (getItemData > 1) {
					gameItems[i].classList.add('hasDuplicate');
					gameItems[i].classList.add('inventory');
					var appendQuantity = document.createTextNode(' ('+getItemData+') ');
					var textspan = gameItems[i].querySelector('span');
				//	alert(textspan);
					textspan.appendChild(appendQuantity);
				} else if (getItemData == 1) {
					gameItems[i].classList.add('inventory');
				}
			} else {
				//newRow.dispatchEvent(eventGoToInv);
				//Not Your ITEMS
			}
		}
	
		var classes = gameItems[i].classList.toString().replace(/\s+/g, ' ').trim().split(' ');
		
		if (classes.indexOf('hasDuplicate') > -1) {
			
			if (classes.indexOf('have') > -1) {
				itemsCount['duplicateWithHave']++;
			} else {
				itemsCount['duplicateWithoutHave']++;
			}
			
			if (classes.indexOf('need') > -1) {
				itemsCount['duplicateWithNeed']++;
			} else {
				itemsCount['duplicateWithoutNeed']++;
			}
			
		}
		
		function setFalseDuplicateStuff() {
			itemsCount['falseDuplicateExist']++;
			if ( classes.indexOf('need') > -1 || classes.indexOf('have') > -1 ) {
				itemsCount['falseDuplicateWithHaveOrNeed']++;
			}
			gameItems[i].style.backgroundColor = 'yellow';
			gameItems[i].style.color = 'grey';
			gameItems[i].setAttribute('data-deprecated-duplicate','true');
		}
		
		var gameItemAlt = gameItems[i].getElementsByTagName('img')[0].getAttribute('alt');
		if ( /&amp;/.test(gameItemAlt) ) {
			setFalseDuplicateStuff();
		} else if ( /&/.test(gameItemAlt) ) {
			var gameItemSrc = gameItems[i].getElementsByTagName('img')[0].getAttribute('src');
			if (/^http:\/\/steamcommunity-a\.akamaihd\.net\/economy\/image\/fWFc82js0fmoRAP/.test(gameItemSrc)) {
				setFalseDuplicateStuff();
			}
		}
					
		if (classes.indexOf('hasDuplicate') === -1 &&
			classes.indexOf('have') === -1 &&
			classes.indexOf('need') === -1 &&
			classes.indexOf('inventory') === -1 &&
			!gameItems[i].getAttribute('data-deprecated-duplicate') &&
			!!gameItems[i].parentNode.querySelector('.hasDuplicate.have')
			)
		{ 
			itemsCount['setNeed']++;
		}
		
		if (classes.indexOf('hasDuplicate') > -1 &&
			classes.indexOf('have') === -1 &&
			classes.indexOf('need') === -1 &&
			classes.indexOf('inventory') > -1 &&
			!gameItems[i].getAttribute('data-deprecated-duplicate')
			)
		{
			itemsCount['setHave']++;
		}
		
		classes.forEach(function (element, index, array) {
			//alert(element);
			itemsCount[element]++;
		});

		observer.observe(gameItems[i], config);
		
		if (location.pathname == '/list/inventory') {
			// get item number (unique)
			var itemData = gameItems[i].getAttribute('data-item'); // get the item number
			
			// is item in inventory true|false
			var itemInInventeory = !!gameItems[i].classList.contains('inventory');
			
			// get Numbers of items 0 or 1 or n
			var itemQuantity = 0;
			if (!itemInInventeory) {
				itemQuantity = 0;
			} else if (!gameItems[i].classList.contains('hasDuplicate')) {
				itemQuantity = 1;
			} else {
				var spanCounter = gameItems[i].querySelector('span').textContent;
				var counterPattern = /\(([0-9]{1,})\)/g; // 1x or more
				var counterArray = spanCounter.match(counterPattern);
				var counterResult = counterArray[0].replace(/[()]/gi, '');
				//alert(counterResult);
				itemQuantity = parseInt(counterResult,10);
			}
			
			//alert('itemNumber:' + itemData + ' Is in Inventory:' + itemInInventeory + ' quantitiy:' + itemQuantity);
			GM_setValue(itemData,itemQuantity);
		}
		
		
	}
	
	invokeInterface();
	
});

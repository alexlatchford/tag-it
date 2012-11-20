/*
* jQuery UI Tag-it!
*
* @version v2.0 (06/2011)
* Customised by Alex Latchford for AAM in 15-10-2012
*
* Copyright 2011, Levy Carneiro Jr.
* Released under the MIT license.
* http://aehlke.github.com/tag-it/LICENSE
*
* Homepage:
*   http://aehlke.github.com/tag-it/
*
* Authors:
*   Levy Carneiro Jr.
*   Martin Rehfeld
*   Tobias Schmidt
*   Skylar Challand
*   Alex Ehlke
*
* Maintainer:
*   Alex Ehlke - Twitter: @aehlke
*
* Dependencies:
*   jQuery v1.4+
*   jQuery UI v1.8+
*/
(function($) {

    $.widget('ui.tagit', {
        options: {
            itemName          : 'item',
            fieldName         : null,
            availableTags     : [],
            onlyAvailableTags : false,
            tagSource         : null,
            removeConfirmation: false,
            caseSensitive     : true,
            placeholderText   : null,

            // When enabled, quotes are not neccesary
            // for inputting multi-word tags.
            allowSpaces: false,

            // Whether to animate tag removals or not.
            animate: true,

            // Optionally set a tabindex attribute on the input that gets
            // created for tag-it.
            tabIndex: null,

            // Event callbacks.
            onTagAdded  : null,
            onTagRemoved: null,
            onTagClicked: null
        },


        init: true,
        _create: function() {
            // for handling static scoping inside callbacks
            var that = this;

            // There are 2 kinds of DOM nodes this widget can be instantiated on:
            //     1. UL, OL, or some element containing either of these.
            //     2. INPUT, in which case 'singleField' is overridden to true,
            //        a UL is created and the INPUT is hidden.
            if (this.element.is('input')) {
                this.tagList = $('<ul></ul>').insertAfter(this.element);
                this.element.css('display', 'none');
            } else {
                this.tagList = this.element.find('ul, ol').andSelf().last();
            }

            this._tagInput = $('<input type="text" placeholder="" />').addClass('ui-widget-content');
            if (this.options.tabIndex) {
                this._tagInput.attr('tabindex', this.options.tabIndex);
            }
            if (this.options.placeholderText) {
                this._tagInput.attr('placeholder', this.options.placeholderText);
            }

            // If it comes in the flat array format, convert it to the complicated format, yay for syntactic sugar!
            for (var i in this.options.availableTags) {
                if (typeof this.options.availableTags[i] === 'string') {
                    this.options.availableTags[i] = {
                        label: this.options.availableTags[i],
                        value: this.options.availableTags[i]
                    };
                }
            }

            function _subtractArray(a1, a2) {
                var a2Vals = [],
                    result = [];

                for (var i in a2) a2Vals.push(a2[i].value); // We just care about values :)

                for (var i in a1) {
                    if ($.inArray(a1[i].value, a2Vals) === -1) result.push(a1[i].label); // We only want the labels.
                }
                return result;
            }

            this.options.tagSource = this.options.tagSource || function(search, showChoices) {
                var filter = search.term.toLowerCase();
                var choices = $.grep(this.options.availableTags, function(element) {
                    // Only match autocomplete options that begin with the search term. (Case insensitive.)
                    return (element.label.toLowerCase().indexOf(filter) === 0);
                });
                showChoices(_subtractArray(choices, this.assignedTags()));
            };

            // Bind tagSource callback functions to this context.
            if ($.isFunction(this.options.tagSource)) {
                this.options.tagSource = $.proxy(this.options.tagSource, this);
            }

            this.tagList
                .addClass('tagit')
                .addClass('ui-widget ui-widget-content ui-corner-all')
                // Create the input field.
                .append($('<li class="tagit-new"></li>').append(this._tagInput))
                .click(function(e) {
                    var target = $(e.target);
                    if (target.hasClass('tagit-label')) {
                        that._trigger('onTagClicked', e, target.closest('.tagit-choice'));
                    } else {
                        // Sets the focus() to the input field, if the user
                        // clicks anywhere inside the UL. This is needed
                        // because the input field needs to be of a small size.
                        that._tagInput.focus();
                    }
                });

            // Add existing tags from the list, if any.
            this.tagList.children('li').each(function() {
                if (!$(this).hasClass('tagit-new')) {
                    that.createTag($(this).data('value'), $(this).html(), $(this).attr('class'));
                    $(this).remove();
                }
            });

            // Events.
            this._tagInput
                .keydown(function(event) {
                    // Backspace is not detected within a keypress, so it must use keydown.
                    if (event.which == $.ui.keyCode.BACKSPACE && that._tagInput.val() === '') {
                        var tag = that._lastTag();
                        if (!that.options.removeConfirmation || tag.hasClass('remove')) {
                            // When backspace is pressed, the last tag is deleted.
                            that.removeTag(tag);
                        } else if (that.options.removeConfirmation) {
                            tag.addClass('remove ui-state-highlight');
                        }
                    } else if (that.options.removeConfirmation) {
                        that._lastTag().removeClass('remove ui-state-highlight');
                    }

                    // Comma/Space/Enter are all valid delimiters for new tags,
                    // except when there is an open quote or if setting allowSpaces = true.
                    // Tab will also create a tag, unless the tag input is empty, in which case it isn't caught.
                    if (
                        event.which == $.ui.keyCode.COMMA ||
                        event.which == $.ui.keyCode.ENTER ||
                        (
                            event.which == $.ui.keyCode.TAB &&
                            that._tagInput.val() !== ''
                        ) ||
                        (
                            event.which == $.ui.keyCode.SPACE &&
                            that.options.allowSpaces !== true &&
                            (
                                $.trim(that._tagInput.val()).replace( /^s*/, '' ).charAt(0) != '"' ||
                                (
                                    $.trim(that._tagInput.val()).charAt(0) == '"' &&
                                    $.trim(that._tagInput.val()).charAt($.trim(that._tagInput.val()).length - 1) == '"' &&
                                    $.trim(that._tagInput.val()).length - 1 !== 0
                                )
                            )
                        )
                    ) {
                        event.preventDefault();
                        var label = that._cleanedLabel();
                        that.createTag(that._getValue(label), label);

                        // The autocomplete doesn't close automatically when TAB is pressed.
                        // So let's ensure that it closes.
                        that._tagInput.autocomplete('close');
                    }
                }).blur(function(e){
                    // Create a tag when the element loses focus (unless it's empty).
                    if(0 === that.options.availableTags.length && null === that.options.tagSource){// Only when not using autocomplete
                        var label = that._cleanedLabel();
                        that.createTag(that._getValue(label), label);
                    }
                });
                

            // Autocomplete.
            if (this.options.availableTags || this.options.tagSource) {
                this._tagInput.autocomplete({
                    source: this.options.tagSource,
                    minLength: 0,
                    select: function(event, ui) {
                        that.createTag(ui.item.value, ui.item.label);
                        // Preventing the tag input to be updated with the chosen value.
                        return false;
                    }
                });
            }
            this.init = false;
        },

        _getValue: function(label) {
            if (!this.options.onlyAvailableTags) return label;

            for(var i in this.options.availableTags) {
                if (this.options.availableTags[i].label === label) return this.options.availableTags[i].value;
            }
        },

        _cleanedLabel: function() {
            // Returns the contents of the tag input, cleaned and ready to be passed to createTag
            return $.trim(this._tagInput.val().replace(/^"(.*)"$/, '$1'));
        },

        _lastTag: function() {
            return this.tagList.children('.tagit-choice:last');
        },

        assignedTags: function() {
            // Returns an array of tag string values
            var that = this;
            var tags = [];

            this.tagList.children('.tagit-choice').each(function() {
                tags.push({
                    label: that.tagLabel(this),
                    value: that.tagValue(this)
                });
            });
            return tags;
        },

        tagLabel: function(tag) {
            return $(tag).children('.tagit-label').html(); // Returns the tag's string label.
        },

        tagValue: function(tag) {
            return $(tag).children('input').val(); // Returns the tag's string value.
        },

        _isNew: function(value) {
            var that = this;
            var isNew = true;
            this.tagList.children('.tagit-choice').each(function(i) {
                if (that._formatStr(value) == that._formatStr(that.tagValue(this))) {
                    isNew = false;
                    return false;
                }
            });
            return isNew;
        },

        _formatStr: function(str) {
            if (this.options.caseSensitive) {
                return str;
            }
            return $.trim(str.toLowerCase());
        },

        createTag: function(value, label, additionalClass) {
            var that = this;
            // Automatically trims the value of leading and trailing whitespace.
            value = $.trim(value);
            label = $.trim(label);

            if (!this._isNew(value) || value === '' || label === '') {
                return false;
            }

            var label = $(this.options.onTagClicked ? '<a class="tagit-label"></a>' : '<span class="tagit-label"></span>').text(label);

            // Create tag.
            var tag = $('<li></li>')
                .addClass('tagit-choice ui-widget-content ui-state-default ui-corner-all')
                .addClass(additionalClass)
                .append(label);

            // Button for removing the tag.
            var removeTagIcon = $('<span></span>')
                .addClass('ui-icon ui-icon-close');
            var removeTag = $('<a><span class="text-icon">\xd7</span></a>') // \xd7 is an X
                .addClass('tagit-close')
                .append(removeTagIcon)
                .click(function(e) {
                    that.removeTag(tag); // Removes a tag when the little 'x' is clicked.
                });
            tag.append(removeTag);

            var field = (this.options.fieldName) ? '[' + this.options.fieldName + ']' : '';
            tag.append('<input type="hidden" style="display:none;" value="' + value + '" name="' + this.options.itemName + field + '[]" />');

            if (!this.init)
                this._trigger('beforeTagAdded', null, tag);

            // Cleaning the input.
            this._tagInput.val('');

            // insert tag
            this._tagInput.parent().before(tag);
            if (!this.init)
                this._trigger('afterTagAdded', null, tag);
        },
        
        removeTag: function(tag, animate) {
            animate = animate || this.options.animate;
            tag = $(tag);

            this._trigger('beforeTagRemoved', null, tag);

            // Animate the removal.
            if (animate) {
                var that = this;
                tag.fadeOut('fast').hide('blind', {direction: 'horizontal'}, 'fast', function(){
                    tag.remove();
                    that._trigger('afterTagRemoved', null, tag);
                }).dequeue();
            } else {
                tag.remove();
                this._trigger('afterTagRemoved', null, tag);
            }
        },

        removeAll: function() {
            // Removes all tags.
            var that = this;
            this.tagList.children('.tagit-choice').each(function(index, tag) {
                that.removeTag(tag, false);
            });
        }

    });

})(jQuery);



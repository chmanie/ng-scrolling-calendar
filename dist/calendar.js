/*
Important for fixing chrome scroll artifacts:

body {
  -webkit-backface-visibility:hidden;
}
*/

// loading indicator on top and bottom of calendar

/*
Do: separate scroll handler from rAF render loop
Do: minimize layout cost in render loop.  (Use textContent rather than innerHTML. Use overflow:hidden to keep layout boundary close)
Do: retain inertial scrolling.
Do: GPU accelerate the layer
Don't: have a hover effect that can trigger during scroll
Don't: do anything more than get a scroll offset in the scroll event handler

https://plus.google.com/+PaulIrish/posts/Ee53Gg6VCck
https://medium.com/p/463bc649c7bd


Issues:

- Scroll to today does not work when calendar wasn't built around today

 */


(function (angular) {
  'use strict';

  // Let's add some nice helper methods to the Date object

  Date.prototype.daysOfMonth = function () {
    return new Date(this.getFullYear(), this.getMonth()+1, 0).getDate();
  };

  Date.prototype.getDayKey = function () {
    var day = (this.getDate() < 10) ? '0' + this.getDate() : this.getDate();
    var month = (this.getMonth() + 1 < 10) ? '0' + (this.getMonth()+1) : this.getMonth()+1;
    var year = this.getFullYear();

    return String(year) + String(month) + String(day);
  };

  Date.prototype.goToFirstDayOfWeek = function (firstDayOfWeek) {
    firstDayOfWeek = firstDayOfWeek || 0;
    while(this.getDay() !== firstDayOfWeek) this.setDate(this.getDate() - 1);
    return this;
  };

  Date.prototype.goToLastDayOfWeek = function (lastDayOfWeek) {
    if (lastDayOfWeek === undefined || lastDayOfWeek === null) lastDayOfWeek = 6;
    while(this.getDay() !== lastDayOfWeek) this.setDate(this.getDate() + 1);
    return this;
  };

  Date.prototype.goToFirstDayOfMonth = function () {
    this.setDate(1);
    return this;
  };

  Date.prototype.goToLastDayOfMonth = function () {
    this.setMonth(this.getMonth()+1);
    this.setDate(0);
    return this;
  };

  Date.prototype.goToDayBegin = function () {
    this.setHours(0);
    this.setMinutes(0);
    this.setSeconds(0);
    return this;
  };

  Date.prototype.goToDayEnd = function () {
    this.setHours(23);
    this.setMinutes(59);
    this.setSeconds(59);
    return this;
  };

  Date.prototype.firstDateOfMonth = function () {
    return new Date(this.getFullYear(), this.getMonth(), 1);
  };

  Date.prototype.lastDateOfMonth = function () {
    return new Date(this.getFullYear(), this.getMonth()+1, 0);
  };

  Date.prototype.isSameDay = function (date) {
    return this.getDate() === date.getDate() && this.getMonth() === date.getMonth() && this.getFullYear() === date.getFullYear();
  };

  Date.prototype.addDays = function (days) {
    this.setDate(this.getDate()+days);
    return this;
  };

  Date.prototype.subtractDays = function (days) {
    this.setDate(this.getDate()-days);
    return this;
  };

  Date.prototype.addMonths = function (months) {
    this.setMonth(this.getMonth()+months);
    return this;
  };

  Date.prototype.subtractMonths = function (months) {
    this.setMonth(this.getMonth()-months);
    return this;
  };

  angular.module('scrollingCalendar', []);

  angular.module('scrollingCalendar').factory('calListeners', function(){
    var listeners = {};
    var scope;
    return {
      setScope: function (scp) {
        scope = scp;
      },
      onDrop: function (cb) {
        listeners.drop = cb;
      },
      drop: function (calItem, targetDay, originDay) {
        if (!listeners.drop) return;
        listeners.drop(scope, {
          $item: calItem,
          $targetDay: targetDay,
          $originDay: originDay
        });
      },
      onClick: function (cb) {
        listeners.click = cb;
      },
      click: function (calItem) {
        if (!listeners.click) return;
        return listeners.click(scope, {
          $item: calItem
        });
      }
    };
  });

  angular.module('scrollingCalendar').directive('calendar', ['$window', '$document', '$timeout', '$compile', 'calListeners', '$parse', '$q', '$http', '$templateCache', function($window, $document, $timeout, $compile, calListeners, $parse, $q, $http, $templateCache){
    // Runs during compile

    return {
      // name: '',
      // priority: 1,
      // terminal: true,
      scope: {
        currentMonth: '=',
        currentYear: '=',
        calInterface: '='
      }, // {} = isolate, true = child, false/undefined = no change
      // controller: function($scope, $element, $attrs, $transclude) {},
      // require: 'ngModel', // Array = multiple requires, ? = optional, ^ = check parent elements
      restrict: 'A',
      // template: '',
      // templateUrl: '',
      // replace: true,
      // transclude: true,
      // compile: function(tElement, tAttrs, function transclude(function(scope, cloneLinkingFn){ return function linking(scope, elm, attrs){}})),
      link: function($scope, element, attrs, controller) {

        var seedDateElement, todayElement, firstDate, lastDate, backgroundColor, dayTemplate, tableOffset
          , currentMonthElms, nextMonthElms
          , currentScrollIndex, lastScrollIndex, activeScrollIndex
          , monthBreakpoints, dayScopes, monthElements
          , seedDate = new Date($parse(attrs.calSeedDate)($scope.$parent))
          , originalElement = element[0]
          , originalDocument = $document[0]
          , parentElement = element.parent()
          , originalParentElement = parentElement[0]
          , entryDateKey = attrs.calDateKey
          , defaultBackgroundColor = [233, 229, 236]
          , offset = 0.5
          , speed = 2
          , topScrollTrigger = 200
          , firstDayOfWeek = parseInt(attrs.calFirstDay, 10)
          , mapLastDay = [6, 0, 1, 2, 3, 4, 5]
          , lastDayOfWeek = mapLastDay[firstDayOfWeek];

        calListeners.setScope($scope.$parent);
        calListeners.onDrop($parse(attrs.calDrop));
        calListeners.onClick($parse(attrs.calEntryClick));

        var getDataFn = $parse(attrs.calData);

        function getEntryData(firstDate, lastDate) {
          return getDataFn($scope.$parent, {
            $firstDate: firstDate,
            $lastDate: lastDate
          });
        }

        var dayClickFn = $parse(attrs.calDayClick);

        function dayClick(day) {
          return dayClickFn($scope.$parent, {
            $day: day
          });
        }

        function appendMoreMonthsIfNeeded() {
          if (!monthBreakpoints[activeScrollIndex+2]) {
            populateRange(appendMonth());
            if (!monthBreakpoints[activeScrollIndex+2]) {
              // in very rare cases we need to add two months
              populateRange(appendMonth());
            }
          }
        }

        function prependMoreMonthsIfNeeded() {
          if (!monthBreakpoints[activeScrollIndex-2]) {
            populateRange(prependMonth());
            originalParentElement.scrollTop = monthBreakpoints[activeScrollIndex+1].pos;
            activeScrollIndex = activeScrollIndex + 1;
            // colorizeMonth();
          }
        }

        $scope.calInterface = {
          scrollToNextMonth: function () {
            smoothScrollTo(monthBreakpoints[activeScrollIndex+1].pos)
              .then(appendMoreMonthsIfNeeded);
          },
          scrollToPrevMonth: function () {
            smoothScrollTo(monthBreakpoints[activeScrollIndex-1].pos)
              .then(prependMoreMonthsIfNeeded);
          },
          scrollToToday: function () {
            // - possibility 2: append or prepend rows until today-element appears (maybe in second version)
            //
            // * possibility 1: remove all table rows and build new calendar around today
            if (!todayElement) {
              angular.element(originalDocument.getElementsByTagName('tr')).remove();
              seedDate = new Date();
              loadCalendarAroundDate(seedDate);
              $timeout(colorizeMonth, 50);
            } else {
              smoothScrollTo(todayElement[0].offsetTop - tableOffset).then(function () {
                appendMoreMonthsIfNeeded();
                prependMoreMonthsIfNeeded();
              });
            }
          }
        };

        function getDayTemplate() {
          return $http.get(attrs.calDayTemplate, { cache: $templateCache })
            .success(function (template) {
              dayTemplate = template;
            });
        }

        function populateRange(range) {
          getEntryData(range.firstDate, range.lastDate).then(function (data) {
            while (data && data.length) {
              var date = new Date(data[0][entryDateKey]);
              var scope = dayScopes[date.getDayKey()];
              scope.$entries.push(data.shift());
            }
          });
        }

        function watchScrollIndex() {

          var currentScrollMonth, currentScrollYear, nextScrollMonth, nextScrollYear;

          $timeout(watchScrollIndex, 100);

          if (monthBreakpoints[currentScrollIndex+1] && originalParentElement.scrollTop >= monthBreakpoints[currentScrollIndex+1].pos) {
            currentScrollIndex++;
            // console.log('added 1 to currentScrollIndex to ' + currentScrollIndex);
          }

          if (monthBreakpoints[currentScrollIndex] && originalParentElement.scrollTop < monthBreakpoints[currentScrollIndex].pos && currentScrollIndex !== 0) {
            currentScrollIndex--;
            // console.log('subtracted 1 from currentScrollIndex to ' + currentScrollIndex);
          }

          if (currentScrollIndex !== lastScrollIndex) {

            // console.log(currentScrollIndex);

            lastScrollIndex = currentScrollIndex;

            currentScrollMonth = monthBreakpoints[currentScrollIndex].month;
            currentScrollYear = monthBreakpoints[currentScrollIndex].year;

            $scope.$apply(function () {
              $scope.currentMonth = currentScrollMonth;
              $scope.currentYear = currentScrollYear;
            });

            if (currentScrollMonth === 11) {
              nextScrollMonth = 0;
              nextScrollYear = currentScrollYear+1;
            } else {
              nextScrollMonth = currentScrollMonth + 1;
              nextScrollYear = currentScrollYear;
            }
            currentMonthElms = monthElements[[currentScrollYear, currentScrollMonth].join('_')];
            nextMonthElms = monthElements[[nextScrollYear, nextScrollMonth].join('_')];

            // update color and active scroll index when month elements have changed
            requestAnimationFrame(colorizeMonth);

          }
        }

        function colorizeMonth() {

          function setBackgroundOpacity(elements, opacity) {
            for (var i = elements.length - 1; i >= 0; i--) {
              elements[i].css('background-color', 'rgba(' + backgroundColor + ', ' + opacity + ')');
            }
          }

          if (monthBreakpoints[currentScrollIndex] && monthBreakpoints[currentScrollIndex+1]) {
            var difference = monthBreakpoints[currentScrollIndex+1].pos - monthBreakpoints[currentScrollIndex].pos;
            var pos = originalParentElement.scrollTop - monthBreakpoints[currentScrollIndex].pos;
            var percentage = (pos/difference);
            // var backgroundOpacity = (percentage-offset)*speed/(1-offset);

            // console.log(percentage);

            if (percentage > offset) {
              if (percentage <= 1) {
                setBackgroundOpacity(currentMonthElms, 1);
                setBackgroundOpacity(nextMonthElms, 0);
              }
              activeScrollIndex = currentScrollIndex+1;
              // console.log('set activeScrollIndex to ', activeScrollIndex);
            } else {
              setBackgroundOpacity(currentMonthElms, 0);
              setBackgroundOpacity(nextMonthElms, 1);
              activeScrollIndex = currentScrollIndex;
              // console.log('set activeScrollIndex to ', activeScrollIndex);
            }
          }
        }

        function expandCalendar() {
          if (originalParentElement.scrollTop < topScrollTrigger) {
            // console.log(monthBreakpoints);
            var oldScrollHeight = originalElement.scrollHeight;
            populateRange(prependMonth());
            originalParentElement.scrollTop = originalParentElement.scrollTop + (originalElement.scrollHeight - oldScrollHeight);
            // $timeout(colorizeMonth);
            $scope.$digest();
          } else if ((originalElement.scrollHeight - originalParentElement.offsetHeight) - originalParentElement.scrollTop < 700) {
            populateRange(appendMonth());
            // $timeout(colorizeMonth);
            $scope.$digest();
          }
        }

        function generateDay(day, date, data) {
          var scope = $scope.$new();
          scope.$entries = [];

          // assign all the helpers
          scope.$dateObj = new Date(date);
          scope.$date = date.getDate();
          scope.$day = date.getDay();
          scope.$month = date.getMonth()+1;
          scope.$isToday = date.isSameDay(new Date());
          scope.$isPastDate = date < new Date() && !date.isSameDay(new Date());
          scope.$showMonthTitle = date.getDay() === lastDayOfWeek && date.getDate() <= 7;

          day = angular.element(day);

          if (tableOffset === undefined) {
            tableOffset = originalElement.offsetTop - day[0].offsetParent.offsetTop;
          }

          dayScopes[date.getDayKey()] = scope;

          var monthKey = [date.getFullYear(), date.getMonth()].join('_');
          monthElements[monthKey] = monthElements[monthKey] || [];
          monthElements[monthKey].push(day);

          day.html(dayTemplate);

          if (scope.$isToday) {
            todayElement = day;
            day.addClass('today');
          }

          if (seedDate.isSameDay(scope.$dateObj)) {
            seedDateElement = day;
          }

          day.bind('click', function () {
            dayClick(scope);
          });

          $compile(day)(scope);

        }

        function firstDayOffset (offsetArray, firstDayOfWeek) {
          firstDayOfWeek = firstDayOfWeek || 0;
          var offsets = [0, 1, 2, 3, 4, 5, 6].map(function (day) {
            day = day - firstDayOfWeek;
            if (day < 0) day = 7 + day;
            return day;
          });

          var retArray = [];

          for (var i = 0; i < offsetArray.length; i++) {
            retArray[i] = offsetArray[offsets[i]];
          }

          return retArray;

        }

        function linesOfMonth (date, offset) {
          // calculate additional weeks cause by month addition
          var daysOfMonth = date.daysOfMonth();
          return Math.ceil((daysOfMonth - offset)/7);
        }

        function prependMonth() {
          var tempDate = new Date(firstDate);
          var dayOfMonth = tempDate.getDate();
          var weekOffset = 0;
          if (dayOfMonth === 1) {
            tempDate.setDate(0); // jump to correct month
          }

          var offset = firstDayOffset([1, 2, 3, 4, 5, 6, 0], firstDayOfWeek)[tempDate.lastDateOfMonth().getDay()];

          var numWeeks = linesOfMonth(tempDate, offset);

          var dataLastDate = new Date(firstDate).subtractDays(1);
          var dataFirstDate = new Date(firstDate).subtractDays((numWeeks)*7);

          var firstWeek, lastWeek;

          for(var i = 0; i < numWeeks; i++) {
            if (i === 0) {
              lastWeek = prependWeek();
            } else {
              firstWeek = prependWeek();
            }
          }

          var monthDate = (new Date(firstDate)).addDays(7);

          // shift all the other breakpoints
          for (var j = monthBreakpoints.length - 1; j >= 0; j--) {
            monthBreakpoints[j].pos = monthBreakpoints[j].pos + (lastWeek.offsetTop - firstWeek.offsetTop + lastWeek.offsetHeight);
          }

          monthBreakpoints.unshift({ month: monthDate.getMonth(), pos: 0, year: monthDate.getFullYear() });

          return {
            firstDate: dataFirstDate.goToDayBegin(),
            lastDate: dataLastDate.goToDayEnd()
          };

        }

        function appendMonth() {
          var tempDate = new Date(lastDate);
          var dayOfMonth = tempDate.getDate();
          if (dayOfMonth > 7) {
            // we're on the last day of the current month
            tempDate.setDate(dayOfMonth + 1); // jump to correct month
          }

          var offset = firstDayOffset([0, 6, 5, 4, 3, 2, 1], firstDayOfWeek)[tempDate.firstDateOfMonth().getDay()];

          var numWeeks = linesOfMonth(tempDate, offset);

          var dataFirstDate = (new Date(lastDate)).addDays(1);
          var dataLastDate = (new Date(dataFirstDate)).addDays((numWeeks)*7-1);

          for(var i = 0; i < numWeeks; i++) appendWeek();

          return {
            firstDate: dataFirstDate.goToDayBegin(),
            lastDate: dataLastDate.goToDayEnd()
          };

        }

        function prependWeek() {
          var week = originalElement.insertRow(0);

          // move firstDate to the beginning of the previous week assuming it is already at the beginning of a week
          do {
            firstDate.subtractDays(1);

            var day = week.insertCell(0);
            generateDay(day, firstDate);

          } while (firstDate.getDay() !== firstDayOfWeek);

          return week;
        }


        function appendWeek() {
          var week = originalElement.insertRow(-1);
          // move lastDate to the end of the next week assuming it is already at the end of a week
          do {
            lastDate.addDays(1);
            if(lastDate.getDate() === 1) {
              var tempDate = new Date(lastDate);
              // wait for browser to correctly calculate offsetTop
              $timeout(addBreakpoint, 50);
            }
            var day = week.insertCell(-1);
            generateDay(day, lastDate);
          } while (lastDate.getDay() !== lastDayOfWeek);

          function addBreakpoint() {
            monthBreakpoints.push({ month: tempDate.getMonth(), pos: week.offsetTop, year: tempDate.getFullYear() });
          }

          return week;
        }

        function completeFirstMonth(seedDate) {
          var startDate = new Date(seedDate);
          firstDate = new Date(seedDate);

          // move firstDate to the beginning of the week
          while(firstDate.getDay() !== firstDayOfWeek) firstDate.setDate(firstDate.getDate() - 1);

          // set lastDate to the day before firstDate
          lastDate = new Date(firstDate);
          lastDate.setDate(firstDate.getDate() - 1);

          // first week
          var week;
          while (firstDate.getMonth() === startDate.getMonth() && firstDate.getDate() !== 1) {
            week = prependWeek();
          }
          if (week) {
            monthBreakpoints.push({ month: lastDate.getMonth(), pos: week.offsetTop, year: lastDate.getFullYear() });
          } else {
            // date already is in the first week of current month. just append one week
            week = appendWeek();
          }

          // next weeks
          var lastDateOfMonth = (new Date(lastDate)).lastDateOfMonth();
          while (lastDate < lastDateOfMonth) appendWeek();

          var dataFirstDate = new Date(seedDate);
          var dataLastDate = new Date(seedDate);

          return {
            firstDate: dataFirstDate.goToFirstDayOfMonth().goToFirstDayOfWeek(firstDayOfWeek).goToDayBegin(),
            lastDate: dataLastDate.goToLastDayOfMonth().goToLastDayOfWeek(lastDayOfWeek).goToDayEnd()
          };

        }

        function loadCalendarAroundDate(seedDate) {

          if(!seedDate) throw new Error('seedDate is required!');

          monthBreakpoints = [];
          dayScopes = {};
          monthElements = {};

          parentElement.css('visibility', 'hidden');

          // we need this for scrolling on very big screens
          element.after('<div style="height:1200px"></div>');

          // async http operations
          getDayTemplate()

          .then(function () {

            // build up calendar
            populateRange(completeFirstMonth(seedDate));
            populateRange(prependMonth());
            populateRange(prependMonth());
            populateRange(appendMonth());
            populateRange(appendMonth());

            // get cell background color from css
            backgroundColor = getBackgroundColor();
            currentScrollIndex = 1;

            // console.log(seedDateElement);

            originalParentElement.scrollTop = seedDateElement[0].offsetTop - tableOffset;
            // console.log(seedDateElement[0].offsetParent);
            // console.log(seedDateElement);
            parentElement.css('visibility', 'visible');

            $timeout(colorizeMonth);

          });

        }

        function getBackgroundColor() {
          var cssBackground, firstTableCell = originalDocument.getElementsByTagName('td')[0];
          if ($window.getComputedStyle) {
            cssBackground = $window.getComputedStyle(firstTableCell)['backgroundColor'] || '';
          } else {
            cssBackground = firstTableCell.currentStyle.backgroundColor || '';
          }
          var color = cssBackground.match(/rgb\((\d{1,3}),\s(\d{1,3}),\s(\d{1,3})\)/);
          if (!color) return defaultBackgroundColor.join(',');
          return color.slice(1,4).join(',');
        }

        var scrolling = false;

        function smoothScrollTo(pos) {

          var deferred = $q.defer();
          if (originalParentElement.scrollTop === pos || scrolling) {
            deferred.reject(new Error('Already scrolling or already there!'));
            return deferred.promise;
          }

          var startTime = new Date();
          var originalPos = originalParentElement.scrollTop;

          function curve(x) {
            return (x < 0.5) ? (4*x*x*x) : (1 - 4*(1-x)*(1-x)*(1-x));
          }

          function scroll() {
            if (originalPos > pos && originalParentElement.scrollTop <= pos) {
              scrolling = false;
              return deferred.resolve(originalParentElement.scrollTop);
            } else if (originalPos < pos && originalParentElement.scrollTop >= pos) {
              scrolling = false;
              return deferred.resolve(originalParentElement.scrollTop);
            }
            var percent = (new Date() - startTime) / 1000;
            originalParentElement.scrollTop = originalParentElement.scrollTop - (originalParentElement.scrollTop - pos) * curve(percent);
            requestAnimationFrame(colorizeMonth);
            requestAnimationFrame(scroll);
          }

          scrolling = true;
          scroll();

          return deferred.promise;

        }

        seedDate = (seedDate.valueOf()) ? seedDate : new Date();

        loadCalendarAroundDate(seedDate);

        $timeout(function () {
          watchScrollIndex();
        }, 50);

        addWheelListener(originalParentElement, function () {
          requestAnimationFrame(colorizeMonth);
          expandCalendar();
        });

      }
    };
  }]);

  /*
   * forked from angular-dragon-drop v0.3.1
   * (c) 2013 Brian Ford http://briantford.com
   * License: MIT
   */

  angular.module('scrollingCalendar').directive('calDay', ['$document', '$compile', '$rootScope', 'calListeners', '$timeout', '$window', function ($document, $compile, $rootScope, calListeners, $timeout, $window) {

    var body = $document[0].body,
      dragValue,
      dragKey,
      dragOrigin,
      floaty,
      offsetX,
      offsetY,
      originElement,
      originElemOffsetX,
      originElemOffsetY;

    var drag = function (ev) {
      var x = ev.clientX - offsetX,
          y = ev.clientY - offsetY;

      floaty.css('left', x + 'px');
      floaty.css('top', y + 'px');
    };

    var remove = function (collection, index) {
      if (collection instanceof Array) {
        return collection.splice(index, 1);
      } else {
        var temp = collection[index];
        delete collection[index];
        return temp;
      }
    };

    var add = function (collection, item, key) {
      if (collection instanceof Array) {
        collection.push(item);
      } else {
        collection[key] = item;
      }
    };

    var documentBody = angular.element($document[0].body);

    var disableSelect = function () {
      documentBody.css({
        '-moz-user-select': '-moz-none',
        '-khtml-user-select': 'none',
        '-webkit-user-select': 'none',
        '-ms-user-select': 'none',
        'user-select': 'none'
      });
    };

    var enableSelect = function () {
      documentBody.css({
        '-moz-user-select': '',
        '-khtml-user-select': '',
        '-webkit-user-select': '',
        '-ms-user-select': '',
        'user-select': ''
      });
    };

    var killFloaty = function () {
      if (floaty) {
        $document.unbind('mousemove', drag);
        floaty.remove();
        floaty = null;
        dragValue = dragOrigin = originElement = null;
      }
    };

    var getElementOffset = function (elt) {

      var box = elt.getBoundingClientRect();

      var xPosition = box.left + body.scrollLeft;
      var yPosition = box.top + body.scrollTop;

      return {
        left: xPosition,
        top: yPosition
      };
    };

    // Get the element at position (`x`, `y`) behind the given element
    var getElementBehindPoint = function (behind, x, y) {
      var originalDisplay = behind.css('display');
      behind.css('display', 'none');

      var element = angular.element($document[0].elementFromPoint(x, y));

      behind.css('display', originalDisplay);

      return element;
    };

    $document.bind('mouseup', function (ev) {

      enableSelect();

      if (!dragValue) {
        return;
      }

      $document.unbind('mousemove', drag);

      var dropArea = getElementBehindPoint(floaty, ev.clientX, ev.clientY);

      var accepts = function () {
        return !!dropArea.attr('cal-day');
      };

      while (dropArea.length > 0 && !accepts()) {
        dropArea = dropArea.parent();
      }

      if (dropArea.length > 0) {

        var expression = dropArea.attr('cal-day');
        var targetScope = dropArea.scope();
        var originScope = originElement.scope();
        var match = expression.match(/^\s*(.+)\s+in\s+(.*?)\s*$/);

        var targetList = targetScope.$eval(match[2]);

        var copy = originScope.$eval(originElement.attr('cal-entry-copyable'));
        var newDragValue = angular.copy(dragValue);
        var newDragKey = angular.copy(dragKey);
        if (targetList !== dragOrigin) {
          targetScope.$apply(function () {
            add(targetList, newDragValue, newDragKey);
          });
          calListeners.drop(newDragValue, targetScope, originScope.$parent);

          if(!copy) {
            $rootScope.$apply(function () {
              remove(dragOrigin, dragKey || dragOrigin.indexOf(dragValue));
            });
          }

          killFloaty();
        } else {
          originElement.css({ 'visibility': 'visible'});
          killFloaty();
        }
      } else {
        $timeout(function () {
          floaty.css({
            'transition': 'all 0.5s',
            '-webkit-transition': 'all 0.5s',
            'left': (originElemOffsetX - body.scrollLeft) + 'px',
            'top': (originElemOffsetY - body.scrollTop) + 'px'
          });
          floaty.bind('webkitTransitionEnd', function () { // TODO: add other browser events
            originElement.css({ 'visibility': 'visible'});
            killFloaty();
          });
        }, 0);
      }
    });

    return {
      restrict: 'A',

      compile: function (container, attr) {

        // get the `thing in things` expression
        var expression = attr.calDay;
        var match = expression.match(/^\s*(.+)\s+in\s+(.*?)\s*$/);
        if (!match) {
          throw Error("Expected calDay in form of '_item_ in _collection_' but got '" +
            expression + "'.");
        }
        var lhs = match[1];
        var rhs = match[2];

        match = lhs.match(/^(?:([\$\w]+)|\(([\$\w]+)\s*,\s*([\$\w]+)\))$/);

        var valueIdentifier = match[3] || match[1];
        var keyIdentifier = match[2];

        // pull out the template to re-use.
        // Improvised ng-transclude.
        var template = container.html();

        // wrap text nodes
        try {
          template = angular.element(template.trim());
          if (template.length === 0) {
            throw new Error('');
          }
        }
        catch (e) {
          template = angular.element('<div>' + template + '</div>'); // TODO: better template
        }
        var child = template.clone();
        child.attr('ng-repeat', expression);

        container.html('');
        container.append(child);

        return function (scope, elt, attr) {

          var spawnFloaty = function () {
            scope.$apply(function () {
              floaty = template.clone();
              floaty.css({
                'position': 'fixed',
                'z-index': '99999',
                'pointer-events': 'none'
              });

              // IE
              if (!supportsPointerEvents()) floaty.css('margin-top', '20px');

              var floatyScope = scope.$new();
              floatyScope[valueIdentifier] = dragValue;
              if (keyIdentifier) {
                floatyScope[keyIdentifier] = dragKey;
              }
              $compile(floaty)(floatyScope);
              documentBody.append(floaty);
              $document.bind('mousemove', drag);
            });
          };

          function getOriginScope(elem) {
            var originScope = elem.scope();
            while (originScope[valueIdentifier] === undefined) {
              originScope = originScope.$parent;
              if (!originScope) return;
            }
            return originScope;
          }

          elt.bind('click', function (ev) {
            var oElement = angular.element(ev.target);
            if (!oElement.attr('cal-day')) {
              ev.stopPropagation();
              var originScope = getOriginScope(oElement);
              calListeners.click(originScope[valueIdentifier]);
            }
          });

          elt.bind('mousedown', function (ev) {

            var oElement = angular.element(ev.target);

            var originScope = getOriginScope(oElement);

            disableSelect();

            var grabTimeout = $timeout(grabElement, 200);

            elt.bind('mouseup', function () {
              $timeout.cancel(grabTimeout);
              elt.unbind('mouseup');
            });

            function grabElement() {

              if (!originScope) return;

              var copy = originScope.$eval(child.attr('cal-entry-copyable'));
              originElement = oElement;

              var canDrag = originScope.$eval(child.attr('cal-entry-draggable'));
              if (dragValue || !canDrag || originElement.attr('cal-day')) {
                return;
              }

              // find the right parent
              while (originElement.attr('cal-entry') === undefined) {
                originElement = originElement.parent();
                if (originElement === body) return;
              }

              dragValue = originScope[valueIdentifier];
              dragKey = originScope[keyIdentifier];
              if (!dragValue) {
                return;
              }

              // get offset inside element to drag
              var offset = getElementOffset(originElement[0]);

              dragOrigin = scope.$eval(rhs);
              // dragValue = angular.copy(dragValue);

              offsetX = (ev.pageX - offset.left);
              offsetY = (ev.pageY - offset.top);

              originElemOffsetX = offset.left;
              originElemOffsetY = offset.top;

              spawnFloaty();
              if(!copy){
                originElement.css({ 'visibility': 'hidden'});
              }
              drag(ev);
            }
          });
        };
      }
    };

  }]);

})(angular);

(function(window, document) {

  'use strict';

  function supportsPointerEvents() {
    // from modernizr

    var element = document.createElement('x'),
      documentElement = document.documentElement,
      getComputedStyle = window.getComputedStyle,
      supports;
    if(!('pointerEvents' in element.style)){
      return false;
    }
    element.style.pointerEvents = 'auto';
    element.style.pointerEvents = 'x';
    documentElement.appendChild(element);
    supports = getComputedStyle &&
      getComputedStyle(element, '').pointerEvents === 'auto';
    documentElement.removeChild(element);
    return !!supports;
  }

  window.supportsPointerEvents = supportsPointerEvents;

  // requestAnimationFrame Polyfill
  // https://github.com/darius/requestAnimationFrame

  if (!Date.now) Date.now = function() { return new Date().getTime(); };

  var vendors = ['webkit', 'moz'];
  for (var i = 0; i < vendors.length && !window.requestAnimationFrame; ++i) {
    var vp = vendors[i];
    window.requestAnimationFrame = window[vp+'RequestAnimationFrame'];
    window.cancelAnimationFrame = (window[vp+'CancelAnimationFrame'] || window[vp+'CancelRequestAnimationFrame']);
  }
  if (/iP(ad|hone|od).*OS 6/.test(window.navigator.userAgent) ||
    !window.requestAnimationFrame ||
    !window.cancelAnimationFrame)
  {
    var lastTime = 0;
    window.requestAnimationFrame = function(callback) {
      var now = Date.now();
      var nextTime = Math.max(lastTime + 16, now);
      return setTimeout(function() { callback(lastTime = nextTime); }, nextTime - now);
    };
    window.cancelAnimationFrame = clearTimeout;
  }
}(window, document));

// creates a global cross-browser "addWheelListener" method
// example: addWheelListener( elem, function( e ) { console.log( e.deltaY ); e.preventDefault(); } );
(function(window,document) {

  'use strict';

  var prefix = '', _addEventListener, onwheel, support;

  // detect event model
  if ( window.addEventListener ) {
    _addEventListener = 'addEventListener';
  } else {
    _addEventListener = 'attachEvent';
    prefix = 'on';
  }

  // detect available wheel event
  support = 'onwheel' in document.createElement('div') ? 'wheel' : // Modern browsers support 'wheel'
            document.onmousewheel !== undefined ? 'mousewheel' : // Webkit and IE support at least 'mousewheel'
            'DOMMouseScroll'; // let's assume that remaining browsers are older Firefox

  window.addWheelListener = function( elem, callback, useCapture ) {
    _addWheelListener( elem, support, callback, useCapture );

    // handle MozMousePixelScroll in older Firefox
    if( support === 'DOMMouseScroll' ) {
      _addWheelListener( elem, 'MozMousePixelScroll', callback, useCapture );
    }
  };

  function _addWheelListener( elem, eventName, callback, useCapture ) {
    elem[ _addEventListener ]( prefix + eventName, support === 'wheel' ? callback : function( originalEvent ) {
        !originalEvent && ( originalEvent = window.event );

        // create a normalized event object
        var event = {
          // keep a ref to the original event object
          originalEvent: originalEvent,
          target: originalEvent.target || originalEvent.srcElement,
          type: 'wheel',
          deltaMode: originalEvent.type === 'MozMousePixelScroll' ? 0 : 1,
          deltaX: 0,
          delatZ: 0,
          preventDefault: function() {
            originalEvent.preventDefault ?
            originalEvent.preventDefault() :
            originalEvent.returnValue = false;
          }
        };

        // calculate deltaY (and deltaX) according to the event
        if ( support === 'mousewheel' ) {
          event.deltaY = - 1/40 * originalEvent.wheelDelta;
          // Webkit also support wheelDeltaX
          originalEvent.wheelDeltaX && ( event.deltaX = - 1/40 * originalEvent.wheelDeltaX );
        } else {
          event.deltaY = originalEvent.detail;
        }

        // it's time to fire the callback
        return callback( event );

      }, useCapture || false );
  }

})(window,document);
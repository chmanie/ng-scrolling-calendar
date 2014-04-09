/*
Important for fixing chrome artifacts:

body {
  -webkit-backface-visibility:hidden;
}
*/


(function (angular) {
  'use strict';

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
        if (listeners.drop) {
          listeners.drop(scope, {
            $item: calItem,
            $targetDay: targetDay,
            $originDay: originDay
          });
        }
      }
    };
  });

  var calName = 'calendar';

  angular.module('scrollingCalendar').directive(calName, function($window, $document, $timeout, $compile, calListeners, $parse, $q, $http, $templateCache){
    // Runs during compile

    return {
      // name: '',
      // priority: 1,
      // terminal: true,
      // scope: {}, // {} = isolate, true = child, false/undefined = no change
      // controller: function($scope, $element, $attrs, $transclude) {},
      // require: 'ngModel', // Array = multiple requires, ? = optional, ^ = check parent elements
      restrict: 'A',
      // template: '',
      // templateUrl: '',
      // replace: true,
      // transclude: true,
      // compile: function(tElement, tAttrs, function transclude(function(scope, cloneLinkingFn){ return function linking(scope, elm, attrs){}})),
      link: function($scope, element, attrs, controller) {

        var firstWeekElement, firstDate, lastDate, backgroundColor, currentMonth, nextMonth, dayTemplate
          , originalElement = element[0]
          , originalDocument = $document[0]
          , parentElement = element.parent()
          , originalParentElement = parentElement[0]
          , scrollDates = []
          , entryDateProp = 'dateBegin'
          , defaultBackgroundColor = [233, 229, 236]
          , offset = 0.5
          , speed = 2
          , firstDayOfWeek = 1
          , mapLastDay = [6, 0, 1, 2, 3, 4, 5]
          , lastDayOfWeek = mapLastDay[firstDayOfWeek];
          

        calListeners.setScope($scope);
        calListeners.onDrop($parse(attrs.calDrop));

        var getDataFn = $parse(attrs.calData);

        function getEntryData(firstDate, lastDate) {
          return getDataFn($scope, {
            $firstDate: firstDate,
            $lastDate: lastDate
          });
        }

        function getDayTemplate() {
          return $http.get('day.html', { cache: $templateCache })
            .success(function (template) {
              dayTemplate = template;
            });
        }

        function colorizeMonth() {

          if (scrollDates[$scope.currentScrollIndex+1] && originalParentElement.scrollTop > scrollDates[$scope.currentScrollIndex+1].pos) {
            $scope.$apply($scope.currentScrollIndex++);
          }

          if (scrollDates[$scope.currentScrollIndex] && originalParentElement.scrollTop < scrollDates[$scope.currentScrollIndex].pos) {
            $scope.$apply($scope.currentScrollIndex--);
          }

          if (scrollDates[$scope.currentScrollIndex] && scrollDates[$scope.currentScrollIndex+1]) {
            var difference = scrollDates[$scope.currentScrollIndex+1].pos - scrollDates[$scope.currentScrollIndex].pos;
            var pos = originalParentElement.scrollTop - scrollDates[$scope.currentScrollIndex].pos;
            var percentage = (pos/difference);
            
            if (percentage>offset && (percentage-offset)*speed/(1-offset) <= 1) {
              currentMonth.css({
                'background-color': 'rgba(' + backgroundColor + ', ' + ((percentage-offset)*speed/(1-offset)) + ')'
              });
              nextMonth.css({
                'background-color': 'rgba(' + backgroundColor + ', ' + (1-(percentage-offset)*speed/(1-offset)) + ')'
              });
            }
            if (percentage<offset) {
              currentMonth.css({
                'background-color': 'rgba(' + backgroundColor + ', 0)'
              });
            }

            if ((percentage-offset)*speed/(1-offset) > 1) {
              currentMonth.css({
                'background-color': 'rgba(' + backgroundColor + ', ' + 1 + ')'
              });
              nextMonth.css({
                'background-color': 'rgba(' + backgroundColor + ', ' + 0 + ')'
              });
            }
          }
        }

        function expandCalendar() {
          if (originalParentElement.scrollTop < 200) {
            var oldScrollHeight = originalElement.scrollHeight;
            prependMonth().then(function () {
              originalParentElement.scrollTop = originalElement.scrollHeight - oldScrollHeight + 200;
            });
          }
          else if (originalParentElement.scrollTop > originalElement.scrollHeight - originalParentElement.offsetHeight - 600) {
            appendSomeWeeks();
          }

        }

        function refreshCalendar() {

          colorizeMonth();
          expandCalendar();
          
        }

        function generateDay(day, date, data) {
          var scope = $scope.$new();
          scope.$entries = [];
          // console.log(date);

          // assign all the helpers
          scope.$dateObj = new Date(date);
          scope.$date = date.getDate();
          scope.$day = date.getDay();
          scope.$month = date.getMonth()+1;
          scope.$isToday = sameDay(date, new Date());
          scope.$isPastDate = date < new Date() && !sameDay(date, new Date());

          function sameDay(date, compDate) {
            return date.getDate() === compDate.getDate() && date.getMonth() === compDate.getMonth() && date.getFullYear() === compDate.getFullYear();
          }

          // great algorithm to populate days :{} (entries have to be sorted by date!)
          while (data && data.length) {
            if (sameDay(data[0][entryDateProp], date)) {
              scope.$entries.push(data.shift());
            } else if (sameDay(data[data.length-1][entryDateProp], date)) {
              scope.$entries.push(data.pop());
            } else {
              break;
            }
          }

          day = angular.element(day);

          day.html(dayTemplate);
          day.addClass([date.getYear(), date.getMonth()].join('_'));

          // initialize with background color
          angular.element(day).css({
            'background-color': 'rgba(' + backgroundColor + ', 1)'
          });

          $compile(day)(scope);
          
        }

        function prependMonth(entryData) {
          var lines = calculateWeeks(firstDate);
          var dataLastDate = new Date(firstDate);
          var dataFirstDate = new Date(firstDate);
          dataFirstDate.setDate(dataLastDate.getDate()-(lines)*7);

          // console.log(dataFirstDate);
          // console.log(dataLastDate);

          entryData = entryData || getEntryData(dataFirstDate, dataLastDate);

          return $q.when(getEntryData(dataFirstDate, dataLastDate)).then(function (eData) {
            for(var i = 0; i < lines; i++) {
              if (i < lines - 1) {
                prependWeek(eData);
              } else {
                var week = prependWeek(eData);
                for (var j = scrollDates.length - 1; j >= 0; j--) {
                  scrollDates[j].pos = scrollDates[j].pos + week.offsetHeight*lines;
                }
                var tempDate = new Date(firstDate);
                tempDate.setDate(tempDate.getDate() + 7);
                scrollDates.unshift({ month: tempDate.getMonth(), pos: week.offsetTop, year: tempDate.getYear() });
              }
            }
          });
        }

        function appendSomeWeeks(weeks, entryData) {
          weeks = weeks || 10;
          var dataFirstDate = new Date(lastDate);
          // console.log(dataFirstDate);
          var dataLastDate = new Date(dataFirstDate);
          dataLastDate.setDate(dataLastDate.getDate()+weeks*7);
          // console.log(dataLastDate);
          entryData = entryData || getEntryData(dataFirstDate, dataLastDate);
          return $q.when(entryData).then(function (eData) {
            // console.log(eData);
            for(var i = 0; i < weeks; i++) appendWeek(eData);
          });
        }

        function prependWeek(data) {
          var week = originalElement.insertRow(0);

          // move firstDate to the beginning of the previous week assuming it is already at the beginning of a week
          do {
            firstDate.setDate(firstDate.getDate() - 1);

            var day = week.insertCell(0);
            generateDay(day, firstDate, data);

          } while (firstDate.getDay() !== firstDayOfWeek);

          return week;
        }


        function appendWeek(data) {
          var week = originalElement.insertRow(-1);
          // move lastDate to the end of the next week assuming it is already at the end of a week
          do {
            lastDate.setDate(lastDate.getDate() + 1);
            if(lastDate.getDate() === 1) {
              scrollDates.push({ month: lastDate.getMonth(), pos: week.offsetTop, year: lastDate.getYear() });
            }

            var day = week.insertCell(-1);
            generateDay(day, lastDate, data);
          } while (lastDate.getDay() !== lastDayOfWeek);
          return week;
        }

        function calculateWeeks(date) {
          var tempDate = new Date(date);
          if (tempDate.getDate() === 1) tempDate.setDate(0); // jump to correct month
          var daysOfMonth = new Date(tempDate.getFullYear(), tempDate.getMonth()+1, 0).getDate();
          var dayDiff = daysOfMonth - tempDate.getDate() + 1;
          var weeks = Math.ceil((daysOfMonth - dayDiff) / 7);
          return weeks;
        }

        function completeFirstMonth(seedDate, entryData) {
          var startDate = new Date(seedDate);
          firstDate = new Date(seedDate);

          // move firstDate to the beginning of the week
          while(firstDate.getDay() !== firstDayOfWeek) firstDate.setDate(firstDate.getDate() - 1);

          // set lastDate to the day before firstDate
          lastDate = new Date(firstDate);
          lastDate.setDate(firstDate.getDate() - 1);

          if (!entryData) throw new Error('Could not initialize calendar. Entry-data is missing for first month');
          
          var week;

          while (firstDate.getMonth() === startDate.getMonth() && firstDate.getDate() !== 1) {
            week = prependWeek(entryData);
          }

          if (week) {
            scrollDates.push({ month: lastDate.getMonth(), pos: week.offsetTop, year: lastDate.getYear() });
          } else {
            // date already is in the first week of current month. just append one week
            week = appendWeek(entryData);
          }

          if (!firstWeekElement) firstWeekElement = week;

        }
        
        function loadCalendarAroundDate(seedDate) {

          parentElement.css('opacity', '0');

          var startDate = new Date(seedDate);
          var endDate = new Date(seedDate);
          var weeksToAdd = 10;

          startDate.setMonth(startDate.getMonth()-1);
          startDate.setDate(1);
          while(startDate.getDay() !== firstDayOfWeek) startDate.setDate(startDate.getDate() - 1);
          while(endDate.getDay() !== lastDayOfWeek) endDate.setDate(endDate.getDate() + 1);
          endDate.setDate(endDate.getDate()+(weeksToAdd-1)*7);

          // async http operations
          $q.all([getDayTemplate(), $q.when(getEntryData(startDate, endDate))])

          .then(function (resultArr) {
            var entryData = resultArr[1];
            
            // build up calendar
            // all this is synchronous on initilisation
            completeFirstMonth(seedDate, entryData);
            prependMonth(entryData);
            appendSomeWeeks(weeksToAdd, entryData);
            
            // watch for scroll index changes
            initializeWatch();
            
            // get cell background color from css
            backgroundColor = getBackgroundColor();

            // let the watcher trigger before start colorizing
            $timeout(function () {
              colorizeMonth();
              // scroll to current month
              originalParentElement.scrollTop = firstWeekElement.offsetTop;
              parentElement.css('opacity', '1');
            }, 500);

          });
          
        }

        function initializeWatch() {
          $scope.currentScrollIndex = 0;
          $scope.$watch('currentScrollIndex', function (newIndex) {
            console.log(newIndex);
            var nextM, nextY;
            var month = scrollDates[newIndex].month;
            var year = scrollDates[newIndex].year;
            if (month === 11) {
              nextM = 0;
              nextY = year+1;
            } else {
              nextM = month + 1;
              nextY = year;
            }
            currentMonth = angular.element(originalDocument.getElementsByClassName([year, month].join('_')));
            nextMonth = angular.element(originalDocument.getElementsByClassName([nextY, nextM].join('_')));

          });
        }

        function getBackgroundColor() {
          var cssBackground;
          var todayElm = originalDocument.getElementsByClassName(firstDate.getYear() + '_' + firstDate.getMonth())[0];
          if (todayElm.currentStyle) {
            cssBackground = todayElm.currentStyle.backgroundColor || '';
          } else {
            cssBackground = $window.getComputedStyle(todayElm)['backgroundColor'] || '';
          }
          var color = cssBackground.match(/rgb\((\d{1,3}),\s(\d{1,3}),\s(\d{1,3})\)/);
          if (!color) return defaultBackgroundColor.join(',');
          return color.slice(1,4).join(',');
        }

        loadCalendarAroundDate(new Date());
        parentElement.bind('scroll', refreshCalendar);

      }
    };
  });

  /*
   * forked from angular-dragon-drop v0.3.1
   * (c) 2013 Brian Ford http://briantford.com
   * License: MIT
   */

  angular.module('scrollingCalendar').directive('calDay', function ($document, $compile, $rootScope, calListeners, $timeout, $window) {

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
      if (!dragValue) {
        return;
      }

      enableSelect();
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

        if (targetList !== dragOrigin) {
          targetScope.$apply(function () {
            add(targetList, dragValue, dragKey);
          });

          calListeners.drop(dragValue, targetScope, originScope.$parent);

          $rootScope.$apply(function () {
            remove(dragOrigin, dragKey || dragOrigin.indexOf(dragValue));
          });
          killFloaty();
        } else {
          originElement.css({ 'opacity': '1'});
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
            originElement.css({ 'opacity': '1'});
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
              // floaty.bind('scroll', function (evt) {
              //   console.log(evt);
              // });
              floaty.css({
                'position': 'fixed',
                'z-index': '99999',
                'pointer-events': 'none'
              });

              // IE
              if (!supporsPointerEvents()) floaty.css('margin-top', '20px');

              var floatyScope = scope.$new();
              floatyScope[valueIdentifier] = dragValue;
              if (keyIdentifier) {
                floatyScope[keyIdentifier] = dragKey;
              }
              $compile(floaty)(floatyScope);
              documentBody.append(floaty);
              $document.bind('mousemove', drag);
              disableSelect();
            });
          };

          elt.bind('mousedown', function (ev) {
            
            originElement = angular.element(ev.target);

            var originScope = originElement.scope();

            var canDrag = originScope.$eval(child.attr('cal-entry-draggable'));

            if (dragValue || !canDrag) {
              return;
            }

            // find the right parent
            while (originElement.attr('cal-entry') === undefined) {
              originElement = originElement.parent();
            }

            while (originScope[valueIdentifier] === undefined) {
              originScope = originScope.$parent;
              if (!originScope) {
                return;
              }
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
            originElement.css({ 'opacity': '0'});
            drag(ev);
          });
        };
      }
    };

    function supporsPointerEvents() {
      // from modernizr

      var element = $document[0].createElement('x'),
        documentElement = $document[0].documentElement,
        getComputedStyle = $window.getComputedStyle,
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

  });


})(angular);
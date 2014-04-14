/*
Important for fixing chrome scroll artifacts:

body {
  -webkit-backface-visibility:hidden;
}
*/

// loading indicator on top and bottom of calendar


(function (angular) {
  'use strict';

  // Let's add some nice helper methods to the Date object

  Date.prototype.linesOfMonth = function (firstDayOfWeek) {
    var daysOfMonth = this.daysOfMonth();
    var offset = this.firstDayOffsets(firstDayOfWeek)[this.firstDateOfMonth().getDay()];
    return Math.ceil((offset + daysOfMonth)/7);
  };

  Date.prototype.firstDayOffsets = function (firstDayOfWeek) {
    firstDayOfWeek = firstDayOfWeek || 0;
    var offsets = [0, 1, 2, 3, 4, 5, 6].map(function (day) {
      day = day - firstDayOfWeek;
      if (day < 0) day = 7 + day;
      return day;
    });
    return offsets;
  };

  Date.prototype.daysOfMonth = function () {
    return new Date(this.getFullYear(), this.getMonth()+1, 0).getDate();
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
      scope: {
        currentMonth: '=',
        currentYear: '='
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

        var firstWeekElement, firstDate, lastDate, backgroundColor, currentMonth, nextMonth, dayTemplate, loading
          , currentScrollIndex = 0
          , lastScrollIndex
          , originalElement = element[0]
          , originalDocument = $document[0]
          , parentElement = element.parent()
          , originalParentElement = parentElement[0]
          , scrollDates = []
          , entryDateKey = attrs.calDateKey
          , defaultBackgroundColor = [233, 229, 236]
          // , defaultBackgroundColor = [255, 255, 255]
          , offset = 0.5
          , speed = 2
          , firstDayOfWeek = 1
          , mapLastDay = [6, 0, 1, 2, 3, 4, 5]
          , lastDayOfWeek = mapLastDay[firstDayOfWeek];
          

        calListeners.setScope($scope.$parent);
        calListeners.onDrop($parse(attrs.calDrop));

        var getDataFn = $parse(attrs.calData);

        function getEntryData(firstDate, lastDate) {
          return getDataFn($scope.$parent, {
            $firstDate: firstDate,
            $lastDate: lastDate
          });
        }

        function getDayTemplate() {
          return $http.get(attrs.calDayTemplate, { cache: $templateCache })
            .success(function (template) {
              dayTemplate = template;
            });
        }

        function colorizeMonth() {

          // requestAnimationFrame(colorizeMonth);

          if (scrollDates[currentScrollIndex+1] && originalParentElement.scrollTop > scrollDates[currentScrollIndex+1].pos) {
            currentScrollIndex++;
          }

          if (scrollDates[currentScrollIndex] && originalParentElement.scrollTop < scrollDates[currentScrollIndex].pos) {
            currentScrollIndex--;
          }

          if (currentScrollIndex !== lastScrollIndex) {
            var nextM, nextY;

            console.log(currentScrollIndex);
            lastScrollIndex = currentScrollIndex;

            $scope.currentMonth = scrollDates[currentScrollIndex].month;
            $scope.currentYear = scrollDates[currentScrollIndex].year;
            
            if ($scope.currentMonth === 11) {
              nextM = 0;
              nextY = $scope.currentYear+1;
            } else {
              nextM = $scope.currentMonth + 1;
              nextY = $scope.currentYear;
            }
            currentMonth = angular.element(originalDocument.getElementsByClassName([$scope.currentYear, $scope.currentMonth].join('_')));
            nextMonth = angular.element(originalDocument.getElementsByClassName([nextY, nextM].join('_')));

          }

          if (scrollDates[currentScrollIndex] && scrollDates[currentScrollIndex+1]) {
            var difference = scrollDates[currentScrollIndex+1].pos - scrollDates[currentScrollIndex].pos;
            var pos = originalParentElement.scrollTop - scrollDates[currentScrollIndex].pos;
            var percentage = (pos/difference);
            var backgroundOpacity = (percentage-offset)*speed/(1-offset);

            // console.log(backgroundOpacity);
            // console.log(percentage);
            
            if (percentage>offset && backgroundOpacity <= 1) {
              currentMonth.css({
                'background-color': 'rgba(' + backgroundColor + ', ' + backgroundOpacity + ')'
              });
              nextMonth.css({
                'background-color': 'rgba(' + backgroundColor + ', ' + (1-backgroundOpacity) + ')'
              });
              console.log('set nextMonth to ' + (1-backgroundOpacity));
            }
            // if (percentage<offset) {
            //   currentMonth.css({
            //     'background-color': 'rgba(' + backgroundColor + ', 0)'
            //   });
            // }

            if (backgroundOpacity > 1) {
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
          if (loading) return;
          if (originalParentElement.scrollTop < 200) {
            var oldScrollHeight = originalElement.scrollHeight;
            loading = true;
            prependMonth().then(function () {
              originalParentElement.scrollTop = originalElement.scrollHeight - oldScrollHeight + 200;
              loading = false;
            });
          }
          else if ((originalElement.scrollHeight - originalParentElement.offsetHeight) - originalParentElement.scrollTop < 700) {
            loading = true;
            appendMonth().then(function () {
              loading = false;
            });
          }
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
          scope.$isToday = date.isSameDay(new Date());
          scope.$isPastDate = date < new Date() && !date.isSameDay(new Date());

          // great algorithm to populate days :{} (entries have to be sorted by date!)
          while (data && data.length) {
            if (date.isSameDay(new Date(data[0][entryDateKey]))) {
              scope.$entries.push(data.shift());
            } else if (date.isSameDay(new Date(data[data.length-1][entryDateKey]))) {
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
          var tempDate = new Date(firstDate);
          var dayOfMonth = tempDate.getDate();
          var weekOffset = 0;
          if (dayOfMonth === 1) {
            tempDate.setDate(0); // jump to correct month
            weekOffset = 1; // we have a week offset if the first day of month is firstDayOfWeek
          }
          var numWeeks = tempDate.linesOfMonth(firstDayOfWeek)+weekOffset;
          
          var dataLastDate = new Date(firstDate).subtractDays(1);
          var dataFirstDate = new Date(firstDate).subtractDays((numWeeks-1)*7);

          // console.log(dataFirstDate);
          // console.log(dataLastDate);

          entryData = entryData || getEntryData(dataFirstDate, dataLastDate);

          return $q.when(getEntryData(dataFirstDate, dataLastDate)).then(function (eData) {
            
            var week;

            for(var i = 0; i < numWeeks-1; i++) {
              week = prependWeek(eData);
            }

            // shift all the other breakpoints
            for (var j = scrollDates.length - 1; j >= 0; j--) {
              scrollDates[j].pos = scrollDates[j].pos + week.offsetHeight*(numWeeks-1);
            }
            var tempDate = (new Date(firstDate)).addDays(7);
            scrollDates.unshift({ month: tempDate.getMonth(), pos: week.offsetTop, year: tempDate.getYear() });
          });
        }

        function appendMonth(entryData) {
          var tempDate = new Date(lastDate);
          var dayOfMonth = tempDate.getDate();
          var weekOffset = 0;
          if (dayOfMonth > 7) {
            // we're on the last day of the current month
            tempDate.setDate(dayOfMonth + 1); // jump to correct month
          }
          var numWeeks = tempDate.linesOfMonth(firstDayOfWeek);

          // console.log('calculated ' + (numWeeks-1) + ' additional lines for ' + (tempDate.getMonth()+1));

          var dataFirstDate = (new Date(lastDate)).goToFirstDayOfWeek(firstDayOfWeek);
          var dataLastDate = (new Date(dataFirstDate)).addDays((numWeeks-1)*7-1);

          // console.log(dataFirstDate);
          // console.log(dataLastDate);

          entryData = entryData || getEntryData(dataFirstDate, dataLastDate);
          return $q.when(entryData).then(function (eData) {
            for(var i = 0; i < numWeeks-1; i++) appendWeek(eData);
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



        function completeFirstMonth(seedDate, entryData) {
          var startDate = new Date(seedDate);
          firstDate = new Date(seedDate);

          // move firstDate to the beginning of the week
          while(firstDate.getDay() !== firstDayOfWeek) firstDate.setDate(firstDate.getDate() - 1);

          // set lastDate to the day before firstDate
          lastDate = new Date(firstDate);
          lastDate.setDate(firstDate.getDate() - 1);

          if (!entryData) throw new Error('Could not initialize calendar. Entry-data is missing for first month');
          

          // first week
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

          // next weeks
          var lastDateOfMonth = (new Date(lastDate)).lastDateOfMonth();
          while (lastDate < lastDateOfMonth) appendWeek(entryData);

        }
        
        function loadCalendarAroundDate(seedDate) {

          parentElement.css('visibility', 'hidden');

          var startDate = new Date(seedDate);
          var endDate = new Date(seedDate);

          startDate.subtractMonths(1).goToFirstDayOfMonth().goToFirstDayOfWeek(firstDayOfWeek);
          endDate.addMonths(1).goToLastDayOfMonth().goToLastDayOfWeek(lastDayOfWeek);

          // console.log(startDate);
          // console.log(endDate);

          // async http operations
          $q.all([getDayTemplate(), $q.when(getEntryData(startDate, endDate))])

          .then(function (resultArr) {
            var entryData = resultArr[1];
            
            // build up calendar
            // all this is synchronous on initilization
            completeFirstMonth(seedDate, entryData);
            prependMonth(entryData);
            appendMonth(entryData);
            
            // watch for scroll index changes
            // initializeWatch();
            // watchScrollIndex();
            
            // get cell background color from css
            backgroundColor = getBackgroundColor();

            // let the watcher trigger before start colorizing
            $timeout(function () {
              colorizeMonth();
              // all kinds of performace tests
              // requestAnimationFrame(colorizeMonth);
              // setInterval(colorizeMonth, 10);

              // scroll to current month
              originalParentElement.scrollTop = firstWeekElement.offsetTop;
              parentElement.css('visibility', 'visible');
              parentElement.bind('scroll', refreshCalendar);
              // intervalExpand();

            }, 500);

          });
          
        }

        // function watchScrollIndex() {
        //   if (currentScrollIndex !== lastScrollIndex) {
        //     var nextM, nextY;

        //     console.log(currentScrollIndex);
        //     lastScrollIndex = currentScrollIndex;

        //     $scope.currentMonth = scrollDates[currentScrollIndex].month;
        //     $scope.currentYear = scrollDates[currentScrollIndex].year;
            
        //     if ($scope.currentMonth === 11) {
        //       nextM = 0;
        //       nextY = $scope.currentYear+1;
        //     } else {
        //       nextM = $scope.currentMonth + 1;
        //       nextY = $scope.currentYear;
        //     }
        //     currentMonth = angular.element(originalDocument.getElementsByClassName([$scope.currentYear, $scope.currentMonth].join('_')));
        //     nextMonth = angular.element(originalDocument.getElementsByClassName([nextY, nextM].join('_')));

        //   }
        //   setTimeout(watchScrollIndex, 100);
        // }

        // function initializeWatch() {
        //   $scope.currentScrollIndex = 0;
        //   $scope.$watch('currentScrollIndex', function (newIndex) {
        //     console.log(newIndex);
        //     var nextM, nextY;

        //     $scope.currentMonth = scrollDates[newIndex].month;
        //     $scope.currentYear = scrollDates[newIndex].year;

        //     if ($scope.currentMonth === 11) {
        //       nextM = 0;
        //       nextY = $scope.currentYear+1;
        //     } else {
        //       nextM = $scope.currentMonth + 1;
        //       nextY = $scope.currentYear;
        //     }
        //     currentMonth = angular.element(originalDocument.getElementsByClassName([$scope.currentYear, $scope.currentMonth].join('_')));
        //     nextMonth = angular.element(originalDocument.getElementsByClassName([nextY, nextM].join('_')));

        //   });
        // }

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

        function refreshCalendar() {
          requestAnimationFrame(colorizeMonth);
          expandCalendar();
        }

        // function intervalExpand() {
        //   expandCalendar();
        //   setTimeout(intervalExpand, 100);
        // }

        loadCalendarAroundDate(new Date());

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
              // floaty.bind('scroll', function (evt) {
              //   console.log(evt);
              // });
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
              disableSelect();
            });
          };

          // console.log(elt);

          elt.bind('mousedown', function (ev) {
            
            originElement = angular.element(ev.target);

            var originScope = originElement.scope();

            var canDrag = originScope.$eval(child.attr('cal-entry-draggable'));

            if (dragValue || !canDrag || originElement.attr('cal-day')) {
              return;
            }

            // find the right parent
            while (originElement.attr('cal-entry') === undefined) {
              originElement = originElement.parent();
              if (originElement === body) return;
            }

            while (originScope[valueIdentifier] === undefined) {
              originScope = originScope.$parent;
              if (!originScope) return;
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
            originElement.css({ 'visibility': 'hidden'});
            drag(ev);
          });
        };
      }
    };

  });

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

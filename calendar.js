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

  angular.module('scrollingCalendar').directive(calName, function($window, $document, $timeout, $compile, calListeners, $parse){
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

        var originalElement = element[0];
        var originalDocument = $document[0];
        var parentElement = element.parent();
        var originalParentElement = parentElement[0];
        var todayDate, todayElement, firstDate, lastDate, backgroundColor;
        var scrollDates = [];
        var defaultBackgroundColor = [233, 229, 236];
        var offset = 0.5;
        var speed = 2;
        var firstDayOfWeek = 1;
        var lastDaysOfWeek = [6, 0, 1, 2, 3, 4, 5];
        var currentMonth, nextMonth;

        calListeners.setScope($scope);
        calListeners.onDrop($parse(attrs.calDrop));

        $scope.currentScrollIndex = 0;
        $scope.$watch('currentScrollIndex', function (newIndex) {
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
            prependMonth();
            originalParentElement.scrollTop = originalElement.scrollHeight - oldScrollHeight + 200;
          }
          else if (originalParentElement.scrollTop > originalElement.scrollHeight - originalParentElement.offsetHeight - 600) {
            for(var i = 0; i < 10; i++) appendWeek();
          }

        }

        function refreshCalendar() {

          colorizeMonth();
          expandCalendar();
          
        }

        function generateDay(day, date) {
          var scope = $scope.$new();
          scope.events = [{ title: 'Bla' }];
          day = angular.element(day);
          var isToday = (date.getDate() === todayDate.getDate() && date.getMonth() === todayDate.getMonth() && date.getFullYear() === todayDate.getFullYear());
          if (isToday) day.addClass('today');
          if (!todayElement) todayElement = angular.element(day);

          day.html(
            '<span>' + date.getDate() + ' ' + (date.getMonth()+1) + '</span>' +
            '<div style="height: 100px" cal-day="event in events">' +
              '<div style="background-color:red;text-align:left" cal-entry cal-entry-draggable="\'true\'">' +
                '<span class="event">{{event.title}}</span>' +
              '</div>' +
            '</div>'
            );
          day.addClass([date.getYear(), date.getMonth()].join('_'));

          $compile(day)(scope);
          
          angular.element(day).css({
            'background-color': 'rgba(' + backgroundColor + ', 1)'
          });

        }

        function prependMonth() {
          var lines = calculateWeeks(firstDate);
          for(var i = 0; i < lines; i++) {
            if (i < lines - 1) {
              prependWeek();
            } else {
              var week = prependWeek();
              for (var j = scrollDates.length - 1; j >= 0; j--) {
                scrollDates[j].pos = scrollDates[j].pos + week.offsetHeight*lines;
              }
              var tempDate = new Date(firstDate);
              tempDate.setDate(tempDate.getDate() + 7);
              scrollDates.unshift({ month: tempDate.getMonth(), pos: week.offsetTop, year: tempDate.getYear() });
            }
          }
        }

        function prependWeek() {
          var week = originalElement.insertRow(0);

          // move firstDate to the beginning of the previous week assuming it is already at the beginning of a week
          do {
            firstDate.setDate(firstDate.getDate() - 1);

            var day = week.insertCell(0);
            generateDay(day, firstDate);

          } while (firstDate.getDay() !== firstDayOfWeek);

          return week;
        }


        function appendWeek() {
          var week = originalElement.insertRow(-1);
          // move lastDate to the end of the next week assuming it is already at the end of a week
          do {
            lastDate.setDate(lastDate.getDate() + 1);
            if(lastDate.getDate() === 1) {
              scrollDates.push({ month: lastDate.getMonth(), pos: week.offsetTop, year: lastDate.getYear() });
            }

            var day = week.insertCell(-1);
            generateDay(day, lastDate);
          } while (lastDate.getDay() !== lastDaysOfWeek[firstDayOfWeek]);

        }

        function calculateWeeks(date) {
          var tempDate = new Date(date);
          if (tempDate.getDate() === 1) tempDate.setDate(0); // jump to correct month
          var daysOfMonth = new Date(tempDate.getFullYear(), tempDate.getMonth()+1, 0).getDate();
          var dayDiff = daysOfMonth - tempDate.getDate() + 1;
          var weeks = Math.ceil((daysOfMonth - dayDiff) / 7);
          return weeks;
        }
        
        function loadCalendarAroundDate(seedDate) {
          var startDate = new Date(seedDate);
          firstDate = new Date(seedDate);

          // move firstDate to the beginning of the week
          while(firstDate.getDay() !== firstDayOfWeek) firstDate.setDate(firstDate.getDate() - 1);

          // set lastDate to the day before firstDate
          lastDate = new Date(firstDate);
          lastDate.setDate(firstDate.getDate() - 1);

          var week, wasFirst;

          while (firstDate.getMonth() === startDate.getMonth() && firstDate.getDate() !== 1) {
            week = prependWeek();
          }

          scrollDates.push({ month: seedDate.getMonth(), pos: week.offsetTop, year: lastDate.getYear() });

          // prepend the first month
          prependMonth();

          // append enough weeks
          for(var i = 1; i<=10; i++) appendWeek();

          // scroll to today
          originalParentElement.scrollTop = todayElement[0].offsetTop;

          backgroundColor = getBackgroundColor();

          // let the watcher trigger before start colorizing
          $timeout(colorizeMonth, 50);
        }

        function getBackgroundColor() {
          var cssBackground;
          var todayElm = originalDocument.getElementsByClassName('today')[0];
          if (todayElm.currentStyle) {
            cssBackground = todayElm.currentStyle.backgroundColor;
          } else {
            cssBackground = $window.getComputedStyle(todayElm)['backgroundColor'];
          }
          var color = cssBackground.match(/rgb\((\d{1,3}),\s(\d{1,3}),\s(\d{1,3})\)/).slice(1,4).join(',');
          if (!color) return defaultBackgroundColor.join(',');
          return color;
        }

        todayDate = new Date();
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

          calListeners.drop(dragValue, targetScope.day, originScope.day);

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
        console.log(template);

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

              $document.bind('scroll', function (evt) {
                console.log(evt);
              });

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
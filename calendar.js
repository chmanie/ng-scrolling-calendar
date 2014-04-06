/*
Important for fixing chrome artifacts:

body {
  -webkit-backface-visibility:hidden;
}
*/


(function (angular) {
  'use strict';

  angular.module('scrollingCalendar', []);

  var calName = 'calendar';

  angular.module('scrollingCalendar').directive(calName, function($window, $document){
    // Runs during compile


    return {
      // name: '',
      // priority: 1,
      // terminal: true,
      // scope: {}, // {} = isolate, true = child, false/undefined = no change
      // controller: function($scope, $element, $attrs, $transclude) {},
      // require: 'ngModel', // Array = multiple requires, ? = optional, ^ = check parent elements
      // restrict: 'A', // E = Element, A = Attribute, C = Class, M = Comment
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
        var todayDate;
        var firstDate;
        var lastDate;
        var scrollDates = [];
        $scope.currentScrollIndex = 0;
        var currentMonth, nextMonth;

        $scope.$watch('currentScrollIndex', function (newIndex) {
          var nextM, nextY;
          var month = scrollDates[newIndex].month;
          var year = scrollDates[newIndex].year;
          currentMonth = angular.element(originalDocument.getElementsByClassName([year, month].join('_')));
          if (month === 11) {
            nextM = 0;
            nextY = year+1;
          } else {
            nextM = month + 1;
            nextY = year;
          }
          nextMonth = angular.element(originalDocument.getElementsByClassName([nextY, nextM].join('_')));

          // console.log(scrollDates);

          // console.log(currentMonth);
          // console.log([nextY, nextM].join('_'));

          // console.log(newIndex);
          // console.log(scrollDates);

          // console.log(nextMonth);

        });

        var counter = 0;

        var color = [233, 229, 236].join(',');

        function expandCalendar() {
          // console.log(originalParentElement.scrollTop);
          // counter++;
          // if (counter < 10) return;
          // counter = 0;

          if (scrollDates[$scope.currentScrollIndex+1] && originalParentElement.scrollTop > scrollDates[$scope.currentScrollIndex+1].pos) {
            // console.log(scrollDates[$scope.currentScrollIndex+1].month + 1);
            $scope.$apply($scope.currentScrollIndex++);
          }

          if (scrollDates[$scope.currentScrollIndex] && originalParentElement.scrollTop < scrollDates[$scope.currentScrollIndex].pos) {
            // console.log(scrollDates[$scope.currentScrollIndex-1].month + 1);
            $scope.$apply($scope.currentScrollIndex--);
          }

          if (originalParentElement.scrollTop < 200) {
            var oldScrollHeight = originalElement.scrollHeight;
            // for(var i = 0; i < calculateAdditionalLines(firstDate); i++) prependWeek();
            prependMonth();
            originalParentElement.scrollTop = originalElement.scrollHeight - oldScrollHeight + 200;
            // console.log('added ' + calculateAdditionalLines(firstDate) + ' weeks');
          }
          else if (originalParentElement.scrollTop > originalElement.scrollHeight - originalParentElement.offsetHeight - 600) {
            for(var i = 0; i < 10; i++) appendWeek();
            console.log(lastDate);
          }

          if (scrollDates[$scope.currentScrollIndex] && scrollDates[$scope.currentScrollIndex+1]) {
            var difference = scrollDates[$scope.currentScrollIndex+1].pos - scrollDates[$scope.currentScrollIndex].pos;
            var pos = originalParentElement.scrollTop - scrollDates[$scope.currentScrollIndex].pos;
            var val = (pos/difference);
            var offset = 0.5;
            var speed = 2;
            
            // console.log(val);
            if (val>offset && (val-offset)*speed/(1-offset) <= 1) {
              // console.log('rgba(0, 128, 128, ' + val + ')');
              currentMonth.css({
                'background-color': 'rgba(' + color + ', ' + ((val-offset)*speed/(1-offset)) + ')'
              });
              // console.log(currentMonth);
              // console.log(val);
              nextMonth.css({
                'background-color': 'rgba(' + color + ', ' + (1-(val-offset)*speed/(1-offset)) + ')'
              });
              // console.log(scrollDates[$scope.currentScrollIndex].month + 1 + pos/difference);
            }

            if (val<offset) {
              currentMonth.css({
                'background-color': 'rgba(' + color + ', 0)'
              });
            }

            // if ((val-offset)*speed/(1-offset) > 1) {
            //   currentMonth.css({
            //     'background-color': 'rgba(218, 216, 222, ' + 1 + ')'
            //   });
            //   nextMonth.css({
            //     'background-color': 'rgba(218, 216, 222, ' + 0 + ')'
            //   });
            // }
          }


        }

        function generateDay(day, date) {
          // var isShaded = (date.getMonth() % 2);
          var isToday = (date.getDate() === todayDate.getDate() && date.getMonth() === todayDate.getMonth() && date.getFullYear() === todayDate.getFullYear());

          // if(isShaded) day.className += ' shaded';
          if(isToday) day.className += ' today';

          // day.id = idForDate(date);
          day.innerHTML = '<span>' + date.getDate() + ' ' + (date.getMonth()+1) + '</span>';
          angular.element(day).addClass([date.getYear(), date.getMonth()].join('_'));
          angular.element(day).css({
            'background-color': 'rgba(' + color + ', 1)'
          });

          // lookupItemsForParentId(day.id, function(items)
          // {
          //  for(var i in items)
          //  {
          //    var item = generateItem(day.id, items[i].itemId);
          //    item.value = items[i].itemValue;
          //    recalculateHeight(item.id);
          //  }
          // });
        }

        function prependMonth() {
          var lines = calculateWeeks(firstDate);
          console.log(lines);
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
              // $scope.currentScrollIndex++;
              // console.log(scrollDates);
            }
          }
          // console.log(firstDate);
        }

        function prependWeek() {
          var week = originalElement.insertRow(0);

          // move firstDate to the beginning of the previous week assuming it is already at the beginning of a week
          do {
            firstDate.setDate(firstDate.getDate() - 1);

            var day = week.insertCell(0);
            generateDay(day, firstDate);
            // console.log(firstDate);

          } while (firstDate.getDay() !== 0);

          // var extra = week.insertCell(-1);
          // extra.className = 'extra';
          // extra.innerHTML = monthName;

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
          } while (lastDate.getDay() !== 6);

          // extra cell for month name
          // var extra = week.insertCell(-1);
          // extra.className = 'extra';
          // extra.innerHTML = monthName;
        }

        function calculateWeeks(date) {
          var tempDate = new Date(date);
          if (tempDate.getDate() === 1) tempDate.setDate(0); // jump to correct month
          var daysOfMonth = new Date(tempDate.getFullYear(), tempDate.getMonth()+1, 0).getDate();
          var dayDiff = daysOfMonth - tempDate.getDate() + 1;

          var weeks = Math.ceil((daysOfMonth - dayDiff) / 7);

          console.log('calculated ' + dayDiff + ' for ' + (tempDate.getMonth() + 1));

          return weeks;




          // // TODO take weekStart into account
          // function firstDayOfMonth(date) {
          //   var tempDate = new Date(date);
          //   tempDate.setDate(1);
          //   return tempDate.getDay() + 1;
          // }

          // function lastDateOfMonth(date) {
          //   return new Date(date.getFullYear(), date.getMonth()+1, 0).getDate();
          // }

          // var lines = (firstDayOfMonth(date) + lastDateOfMonth(date) > 36) ? 5 : 4;

          // if (new Date(date.getFullYear(), date.getMonth()+1, 0).getDay() === 0) lines++;
          // return lines;

        }
        
        function loadCalendarAroundDate(seedDate) {
          // calendarTableElement.innerHTML = '';
          firstDate = new Date(seedDate);

          // move firstDate to the beginning of the week
          while(firstDate.getDay() !== 0) firstDate.setDate(firstDate.getDate() - 1);

          // set lastDate to the day before firstDate
          lastDate = new Date(firstDate);
          lastDate.setDate(firstDate.getDate() - 1);

          // expandCalendar();

          var week = prependWeek();
          // prependWeek();
          scrollDates.push({ month: seedDate.getMonth(), pos: week.offsetTop, year: lastDate.getYear() });

          // console.log(firstDate);

          prependMonth();
          appendWeek();
          appendWeek();
          appendWeek();
          appendWeek();
          
          // prependWeek();
          // prependWeek();
          // prependWeek();
          // prependWeek();
          // prependWeek();
          // prependWeek();
          // prependWeek();
          // prependWeek();
          // prependWeek();
          // prependWeek();
          // prependWeek();
          // prependWeek();

          // console.log(scrollDates);

          // need to let safari recalculate heights before we start scrolling
          // setTimeout('scrollToToday()', 50);
        }

        todayDate = new Date();
        loadCalendarAroundDate(new Date());
        parentElement.bind('scroll', expandCalendar);

      }
    };
  });


})(angular);
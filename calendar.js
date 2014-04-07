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

  angular.module('scrollingCalendar').directive(calName, function($window, $document, $timeout){
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
        var todayDate;
        var todayElement;
        var firstDate;
        var lastDate;
        var scrollDates = [];
        var color = [233, 229, 236].join(',');
        var offset = 0.5;
        var speed = 2;
        var firstDayOfWeek = 1;
        var lastDaysOfWeek = [6, 0, 1, 2, 3, 4, 5];
        var currentMonth, nextMonth;

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
                'background-color': 'rgba(' + color + ', ' + ((percentage-offset)*speed/(1-offset)) + ')'
              });
              nextMonth.css({
                'background-color': 'rgba(' + color + ', ' + (1-(percentage-offset)*speed/(1-offset)) + ')'
              });
            }
            if (percentage<offset) {
              currentMonth.css({
                'background-color': 'rgba(' + color + ', 0)'
              });
            }

            if ((percentage-offset)*speed/(1-offset) > 1) {
              currentMonth.css({
                'background-color': 'rgba(218, 216, 222, ' + 1 + ')'
              });
              nextMonth.css({
                'background-color': 'rgba(218, 216, 222, ' + 0 + ')'
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
          var isToday = (date.getDate() === todayDate.getDate() && date.getMonth() === todayDate.getMonth() && date.getFullYear() === todayDate.getFullYear());
          if (isToday) day.className += ' today';
          if (!todayElement) todayElement = angular.element(day);

          day.innerHTML = '<span>' + date.getDate() + ' ' + (date.getMonth()+1) + '</span>';
          angular.element(day).addClass([date.getYear(), date.getMonth()].join('_'));
          angular.element(day).css({
            'background-color': 'rgba(' + color + ', 1)'
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

          prependMonth();

          for(var i = 1; i<=10; i++) appendWeek();

          originalParentElement.scrollTop = todayElement[0].offsetTop;

          // let the watcher trigger before start colorizing
          $timeout(colorizeMonth, 50);
        }

        todayDate = new Date();
        loadCalendarAroundDate(new Date());
        parentElement.bind('scroll', refreshCalendar);

      }
    };
  });


})(angular);
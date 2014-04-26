(function (angular) {
  'use strict';

  angular.module('scrollingCalendarExample', ['scrollingCalendar']);

  angular.module('scrollingCalendarExample').controller('ExampleCtrl', function($scope, $timeout, $q){
    $scope.getData = function (startDate, endDate) {
      var deferred = $q.defer();
      var date = new Date(startDate);
      var anotherDate = new Date(startDate);
      date.setDate(startDate.getDate()+10);
      anotherDate.setDate(startDate.getDate()+3);

      $timeout(function () {
        deferred.resolve([{ title: 'Blubb', dateBegin: date }, { title: 'Great Event', dateBegin: anotherDate }]);
      }, 500);

      return deferred.promise;
    };

    $scope.calDrop = function (item, targetDay, originDay) {
      console.log(item);
      console.log(targetDay, originDay);
    };

    $scope.dayClick = function (day) {
      console.log(day);
    };

    $scope.entryClick = function (item) {
      console.log(item);
    };

    $scope.seedDate = new Date(2014, 7);

  });

})(angular);
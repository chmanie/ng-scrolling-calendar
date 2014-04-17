(function (angular) {
  'use strict';

  angular.module('scrollingCalendarExample', ['scrollingCalendar']);

  angular.module('scrollingCalendarExample').controller('ExampleCtrl', function($scope, $timeout, $q){
    $scope.getData = function (startDate, endDate) {
      var deferred = $q.defer();
      var date = new Date(startDate);
      date.setDate(startDate.getDate()+10);

      $timeout(function () {
        deferred.resolve([{ title: 'Blubb', dateBegin: date }, { title: 'Today!!!', dateBegin: new Date() }]);
      }, 500);

      return deferred.promise;
    };

    $scope.calDrop = function (item, targetDay, originDay) {
      console.log(item);
      console.log(targetDay, originDay);
    };

    $timeout(function () {
      console.log($scope.calInterface);
    }, 1000);

  });

})(angular);
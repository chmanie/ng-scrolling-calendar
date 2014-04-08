(function (angular) {
  'use strict';

  angular.module('scrollingCalendarExample', ['scrollingCalendar']);

  angular.module('scrollingCalendarExample').controller('ExampleCtrl', function($scope){
    $scope.getData = function (startDate, endDate) {
      var date = new Date(startDate);
      date.setDate(startDate.getDate()+10);
      return [{ title: 'Blubb', dateBegin: date }];
    };
  });

})(angular);
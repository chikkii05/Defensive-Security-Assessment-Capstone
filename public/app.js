// Task list logic. User text is only ever written with textContent (a text-only sink),
// and there are no inline handlers, so the page can run under a strict CSP.
(function () {
  "use strict";
  var MAX_LEN = 200;

  function addTask() {
    var input = document.getElementById("taskInput");
    var taskText = input.value.trim().slice(0, MAX_LEN);
    if (!taskText) return;

    var li = document.createElement("li");
    li.className = "py-2 px-3 text-gray-800 text-sm flex justify-between items-center";
    var span = document.createElement("span");
    span.textContent = taskText; // escapes HTML: markup is shown as literal text
    li.appendChild(span);
    document.getElementById("taskList").appendChild(li);
    input.value = "";
  }

  document.getElementById("addTaskBtn").addEventListener("click", addTask);
  document.getElementById("taskInput").addEventListener("keydown", function (e) {
    if (e.key === "Enter") addTask();
  });
})();

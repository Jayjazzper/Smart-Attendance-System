function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({ success: true, message: "Apps Script API is active" }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  var result = { success: false };
  try {
    var postData = JSON.parse(e.postData.contents);
    var action = postData.action;
    
    // Open active spreadsheet
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    
    // Get or create sheets
    var studentSheet = ss.getSheetByName("students");
    if (!studentSheet) {
      studentSheet = ss.insertSheet("students");
      studentSheet.appendRow(["id", "name", "email", "faceDescriptor"]);
    }
    
    var attendanceSheet = ss.getSheetByName("attendance");
    if (!attendanceSheet) {
      attendanceSheet = ss.insertSheet("attendance");
      attendanceSheet.appendRow(["id", "studentId", "studentName", "studentEmail", "timestamp", "confidence"]);
    }
    
    if (action === "getStudents") {
      var data = studentSheet.getDataRange().getValues();
      var students = [];
      // Skip header row
      for (var i = 1; i < data.length; i++) {
        var row = data[i];
        if (row[0]) {
          var faceDesc = [];
          try {
            faceDesc = JSON.parse(row[3]);
          } catch(e) {
            console.error("Error parsing faceDescriptor for student " + row[0], e);
          }
          students.push({
            id: String(row[0]),
            name: String(row[1]),
            email: String(row[2]),
            faceDescriptor: faceDesc
          });
        }
      }
      result = { success: true, students: students };
      
    } else if (action === "addStudent") {
      var student = postData.student;
      var data = studentSheet.getDataRange().getValues();
      var exists = false;
      for (var i = 1; i < data.length; i++) {
        if (String(data[i][0]) === String(student.id)) {
          exists = true;
          break;
        }
      }
      
      if (exists) {
        result = { success: false, error: "Student ID already exists" };
      } else {
        studentSheet.appendRow([
          student.id,
          student.name,
          student.email,
          JSON.stringify(student.faceDescriptor)
        ]);
        result = { success: true };
      }
      
    } else if (action === "updateStudent") {
      var id = postData.id;
      var name = postData.name;
      var email = postData.email;
      
      var data = studentSheet.getDataRange().getValues();
      var updated = false;
      for (var i = 1; i < data.length; i++) {
        if (String(data[i][0]) === String(id)) {
          studentSheet.getRange(i + 1, 2).setValue(name); // Column B
          studentSheet.getRange(i + 1, 3).setValue(email); // Column C
          updated = true;
          break;
        }
      }
      
      if (updated) {
        // Also update matching records in attendance sheet
        var attData = attendanceSheet.getDataRange().getValues();
        for (var j = 1; j < attData.length; j++) {
          if (String(attData[j][1]) === String(id)) { // Column B is studentId
            attendanceSheet.getRange(j + 1, 3).setValue(name);  // Column C is studentName
            attendanceSheet.getRange(j + 1, 4).setValue(email); // Column D is studentEmail
          }
        }
        result = { success: true };
      } else {
        result = { success: false, error: "Student not found" };
      }
      
    } else if (action === "deleteStudent") {
      var id = postData.id;
      
      // Delete student
      var data = studentSheet.getDataRange().getValues();
      var deleted = false;
      for (var i = 1; i < data.length; i++) {
        if (String(data[i][0]) === String(id)) {
          studentSheet.deleteRow(i + 1);
          deleted = true;
          break;
        }
      }
      
      // Delete attendance records (reverse loop so row shifting doesn't skip)
      var attData = attendanceSheet.getDataRange().getValues();
      for (var j = attData.length - 1; j >= 1; j--) {
        if (String(attData[j][1]) === String(id)) {
          attendanceSheet.deleteRow(j + 1);
        }
      }
      
      result = { success: deleted };
      
    } else if (action === "getAttendance") {
      var data = attendanceSheet.getDataRange().getValues();
      var attendance = [];
      // Skip header row
      for (var i = 1; i < data.length; i++) {
        var row = data[i];
        if (row[0]) {
          attendance.push({
            id: String(row[0]),
            studentId: String(row[1]),
            studentName: String(row[2]),
            studentEmail: String(row[3]),
            timestamp: String(row[4]),
            confidence: Number(row[5])
          });
        }
      }
      result = { success: true, attendance: attendance };
      
    } else if (action === "addAttendance") {
      var record = postData.record;
      attendanceSheet.appendRow([
        record.id,
        record.studentId,
        record.studentName,
        record.studentEmail,
        record.timestamp,
        Number(record.confidence)
      ]);
      result = { success: true };
      
    } else if (action === "reset") {
      // Clear data from students sheet except headers
      var lastRowStudents = studentSheet.getLastRow();
      if (lastRowStudents > 1) {
        studentSheet.deleteRows(2, lastRowStudents - 1);
      }
      
      // Clear data from attendance sheet except headers
      var lastRowAttendance = attendanceSheet.getLastRow();
      if (lastRowAttendance > 1) {
        attendanceSheet.deleteRows(2, lastRowAttendance - 1);
      }
      
      result = { success: true };
    }
    
  } catch (error) {
    result.error = error.toString();
  }
  
  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}
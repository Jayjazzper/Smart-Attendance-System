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
    
    // Get or create sheets with updated columns
    var studentSheet = ss.getSheetByName("students");
    if (!studentSheet) {
      studentSheet = ss.insertSheet("students");
      studentSheet.appendRow(["id", "name", "email", "faceDescriptor", "classroom", "level"]);
    } else {
      // Ensure headers exist for new columns (upgrade existing sheets)
      var headers = studentSheet.getRange(1, 1, 1, studentSheet.getLastColumn() || 6).getValues()[0];
      if (headers.indexOf("classroom") === -1) {
        studentSheet.getRange(1, 5).setValue("classroom");
      }
      if (headers.indexOf("level") === -1) {
        studentSheet.getRange(1, 6).setValue("level");
      }
    }
    
    var attendanceSheet = ss.getSheetByName("attendance");
    if (!attendanceSheet) {
      attendanceSheet = ss.insertSheet("attendance");
      attendanceSheet.appendRow(["id", "studentId", "studentName", "studentEmail", "timestamp", "confidence", "classroom", "status"]);
    } else {
      // Ensure headers exist for new columns (upgrade existing sheets)
      var headers = attendanceSheet.getRange(1, 1, 1, attendanceSheet.getLastColumn() || 8).getValues()[0];
      if (headers.indexOf("classroom") === -1) {
        attendanceSheet.getRange(1, 7).setValue("classroom");
      }
      if (headers.indexOf("status") === -1) {
        attendanceSheet.getRange(1, 8).setValue("status");
      }
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
            faceDescriptor: faceDesc,
            classroom: row[4] ? String(row[4]) : "",
            level: row[5] ? String(row[5]) : ""
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
          JSON.stringify(student.faceDescriptor),
          student.classroom || "",
          student.level || ""
        ]);
        result = { success: true };
      }
      
    } else if (action === "updateStudent") {
      var id = postData.id;
      var name = postData.name;
      var email = postData.email;
      var classroom = postData.classroom;
      var level = postData.level;
      
      var data = studentSheet.getDataRange().getValues();
      var updated = false;
      for (var i = 1; i < data.length; i++) {
        if (String(data[i][0]) === String(id)) {
          studentSheet.getRange(i + 1, 2).setValue(name); // Column B
          studentSheet.getRange(i + 1, 3).setValue(email); // Column C
          if (classroom !== undefined) studentSheet.getRange(i + 1, 5).setValue(classroom); // Column E
          if (level !== undefined) studentSheet.getRange(i + 1, 6).setValue(level); // Column F
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
            if (classroom !== undefined) attendanceSheet.getRange(j + 1, 7).setValue(classroom); // Column G
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
            confidence: Number(row[5]),
            classroom: row[6] ? String(row[6]) : "",
            status: row[7] ? String(row[7]) : "present"
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
        Number(record.confidence),
        record.classroom || "",
        record.status || "present"
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
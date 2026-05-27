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
      studentSheet.appendRow(["id", "name", "email", "faceDescriptor", "consentGiven", "registeredAt", "classroom", "level", "parentLineId", "avatarUrl", "bloodGroup", "emergencyPhone", "medicalAlert"]);
    } else {
      // Ensure headers exist for all columns (upgrade existing sheets dynamically)
      var studentHeaders = studentSheet.getRange(1, 1, 1, studentSheet.getLastColumn() || 13).getValues()[0];
      var requiredStudentHeaders = ["id", "name", "email", "faceDescriptor", "consentGiven", "registeredAt", "classroom", "level", "parentLineId", "avatarUrl", "bloodGroup", "emergencyPhone", "medicalAlert"];
      for (var h = 0; h < requiredStudentHeaders.length; h++) {
        var hName = requiredStudentHeaders[h];
        if (studentHeaders.indexOf(hName) === -1) {
          studentSheet.getRange(1, studentSheet.getLastColumn() + 1).setValue(hName);
        }
      }
    }
    
    var attendanceSheet = ss.getSheetByName("attendance");
    if (!attendanceSheet) {
      attendanceSheet = ss.insertSheet("attendance");
      attendanceSheet.appendRow(["id", "studentId", "studentName", "studentEmail", "timestamp", "confidence", "classroom", "status", "temperature", "healthStatus"]);
    } else {
      // Ensure headers exist for all columns (upgrade existing sheets dynamically)
      var attHeaders = attendanceSheet.getRange(1, 1, 1, attendanceSheet.getLastColumn() || 10).getValues()[0];
      var requiredAttHeaders = ["id", "studentId", "studentName", "studentEmail", "timestamp", "confidence", "classroom", "status", "temperature", "healthStatus"];
      for (var h = 0; h < requiredAttHeaders.length; h++) {
        var hName = requiredAttHeaders[h];
        if (attHeaders.indexOf(hName) === -1) {
          attendanceSheet.getRange(1, attendanceSheet.getLastColumn() + 1).setValue(hName);
        }
      }
    }
    
    var leavesSheet = ss.getSheetByName("leaves");
    if (!leavesSheet) {
      leavesSheet = ss.insertSheet("leaves");
      leavesSheet.appendRow(["id", "studentId", "studentName", "classroom", "startDate", "endDate", "type", "reason", "status", "submittedAt"]);
    } else {
      // Ensure headers exist for all columns (upgrade existing sheets dynamically)
      var leavesHeaders = leavesSheet.getRange(1, 1, 1, leavesSheet.getLastColumn() || 10).getValues()[0];
      var requiredLeavesHeaders = ["id", "studentId", "studentName", "classroom", "startDate", "endDate", "type", "reason", "status", "submittedAt"];
      for (var h = 0; h < requiredLeavesHeaders.length; h++) {
        var hName = requiredLeavesHeaders[h];
        if (leavesHeaders.indexOf(hName) === -1) {
          leavesSheet.getRange(1, leavesSheet.getLastColumn() + 1).setValue(hName);
        }
      }
    }
    
    if (action === "getStudents") {
      var data = studentSheet.getDataRange().getValues();
      var headers = data[0];
      
      var idxId = headers.indexOf("id");
      var idxName = headers.indexOf("name");
      var idxEmail = headers.indexOf("email");
      var idxFaceDescriptor = headers.indexOf("faceDescriptor");
      var idxConsentGiven = headers.indexOf("consentGiven");
      var idxRegisteredAt = headers.indexOf("registeredAt");
      var idxClassroom = headers.indexOf("classroom");
      var idxLevel = headers.indexOf("level");
      var idxParentLineId = headers.indexOf("parentLineId");
      var idxAvatarUrl = headers.indexOf("avatarUrl");
      var idxBloodGroup = headers.indexOf("bloodGroup");
      var idxEmergencyPhone = headers.indexOf("emergencyPhone");
      var idxMedicalAlert = headers.indexOf("medicalAlert");
      
      var students = [];
      // Skip header row and skip any duplicate header rows or literal headers
      for (var i = 1; i < data.length; i++) {
        var row = data[i];
        if (row[0] && String(row[idxId]).toLowerCase() !== "id") {
          var faceDesc = [];
          if (idxFaceDescriptor !== -1 && row[idxFaceDescriptor]) {
            try {
              faceDesc = JSON.parse(row[idxFaceDescriptor]);
            } catch(e) {
              console.error("Error parsing faceDescriptor for student " + row[idxId], e);
            }
          }
          students.push({
            id: String(row[idxId]),
            name: idxName !== -1 ? String(row[idxName]) : "",
            email: idxEmail !== -1 ? String(row[idxEmail]) : "",
            faceDescriptor: faceDesc,
            consentGiven: idxConsentGiven !== -1 ? (String(row[idxConsentGiven]).toLowerCase() === "true" || row[idxConsentGiven] === true) : true,
            registeredAt: idxRegisteredAt !== -1 ? formatDateSafe(row[idxRegisteredAt]) : "",

            classroom: idxClassroom !== -1 ? String(row[idxClassroom]) : "",
            level: idxLevel !== -1 ? String(row[idxLevel]) : "",
            parentLineId: idxParentLineId !== -1 ? String(row[idxParentLineId]) : "",
            avatarUrl: idxAvatarUrl !== -1 ? String(row[idxAvatarUrl]) : "",
            bloodGroup: idxBloodGroup !== -1 ? String(row[idxBloodGroup]) : "",
            emergencyPhone: idxEmergencyPhone !== -1 ? String(row[idxEmergencyPhone]) : "",
            medicalAlert: idxMedicalAlert !== -1 ? String(row[idxMedicalAlert]) : ""
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
        var headers = studentSheet.getRange(1, 1, 1, studentSheet.getLastColumn() || 13).getValues()[0];
        var nextRow = studentSheet.getLastRow() + 1;
        var valuesMap = {
          "id": student.id,
          "name": student.name,
          "email": student.email,
          "faceDescriptor": JSON.stringify(student.faceDescriptor),
          "consentGiven": student.consentGiven ?? true,
          "registeredAt": student.registeredAt || new Date().toISOString(),
          "classroom": student.classroom || "",
          "level": student.level || "",
          "parentLineId": student.parentLineId || "",
          "avatarUrl": student.avatarUrl || "",
          "bloodGroup": student.bloodGroup || "",
          "emergencyPhone": student.emergencyPhone || "",
          "medicalAlert": student.medicalAlert || ""
        };
        
        for (var c = 0; c < headers.length; c++) {
          var header = headers[c];
          if (valuesMap.hasOwnProperty(header)) {
            studentSheet.getRange(nextRow, c + 1).setValue(valuesMap[header]);
          }
        }
        result = { success: true };
      }
      
    } else if (action === "updateStudent") {
      var id = postData.id;
      var name = postData.name;
      var email = postData.email;
      var classroom = postData.classroom;
      var level = postData.level;
      var parentLineId = postData.parentLineId;
      var avatarUrl = postData.avatarUrl;
      var bloodGroup = postData.bloodGroup;
      var emergencyPhone = postData.emergencyPhone;
      var medicalAlert = postData.medicalAlert;
      
      var data = studentSheet.getDataRange().getValues();
      var headers = studentSheet.getRange(1, 1, 1, studentSheet.getLastColumn() || 13).getValues()[0];
      
      var idxId = headers.indexOf("id");
      var idxName = headers.indexOf("name");
      var idxEmail = headers.indexOf("email");
      var idxClassroom = headers.indexOf("classroom");
      var idxLevel = headers.indexOf("level");
      var idxParentLineId = headers.indexOf("parentLineId");
      var idxAvatarUrl = headers.indexOf("avatarUrl");
      var idxBloodGroup = headers.indexOf("bloodGroup");
      var idxEmergencyPhone = headers.indexOf("emergencyPhone");
      var idxMedicalAlert = headers.indexOf("medicalAlert");
      
      var updated = false;
      for (var i = 1; i < data.length; i++) {
        if (idxId !== -1 && String(data[i][idxId]) === String(id)) {
          if (idxName !== -1 && name !== undefined) studentSheet.getRange(i + 1, idxName + 1).setValue(name);
          if (idxEmail !== -1 && email !== undefined) studentSheet.getRange(i + 1, idxEmail + 1).setValue(email);
          if (idxClassroom !== -1 && classroom !== undefined) studentSheet.getRange(i + 1, idxClassroom + 1).setValue(classroom);
          if (idxLevel !== -1 && level !== undefined) studentSheet.getRange(i + 1, idxLevel + 1).setValue(level);
          if (idxParentLineId !== -1 && parentLineId !== undefined) studentSheet.getRange(i + 1, idxParentLineId + 1).setValue(parentLineId);
          if (idxAvatarUrl !== -1 && avatarUrl !== undefined) studentSheet.getRange(i + 1, idxAvatarUrl + 1).setValue(avatarUrl);
          if (idxBloodGroup !== -1 && bloodGroup !== undefined) studentSheet.getRange(i + 1, idxBloodGroup + 1).setValue(bloodGroup);
          if (idxEmergencyPhone !== -1 && emergencyPhone !== undefined) studentSheet.getRange(i + 1, idxEmergencyPhone + 1).setValue(emergencyPhone);
          if (idxMedicalAlert !== -1 && medicalAlert !== undefined) studentSheet.getRange(i + 1, idxMedicalAlert + 1).setValue(medicalAlert);
          updated = true;
          break;
        }
      }
      
      if (updated) {
        // Also update matching records in attendance sheet dynamically
        var attHeaders = attendanceSheet.getRange(1, 1, 1, attendanceSheet.getLastColumn() || 10).getValues()[0];
        var idxAttStudentId = attHeaders.indexOf("studentId");
        var idxAttName = attHeaders.indexOf("studentName");
        var idxAttEmail = attHeaders.indexOf("studentEmail");
        var idxAttClassroom = attHeaders.indexOf("classroom");
        
        if (idxAttStudentId !== -1) {
          var attData = attendanceSheet.getDataRange().getValues();
          for (var j = 1; j < attData.length; j++) {
            if (String(attData[j][idxAttStudentId]) === String(id)) {
              if (idxAttName !== -1 && name !== undefined) attendanceSheet.getRange(j + 1, idxAttName + 1).setValue(name);
              if (idxAttEmail !== -1 && email !== undefined) attendanceSheet.getRange(j + 1, idxAttEmail + 1).setValue(email);
              if (idxAttClassroom !== -1 && classroom !== undefined) attendanceSheet.getRange(j + 1, idxAttClassroom + 1).setValue(classroom);
            }
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
      var headers = data[0];
      
      var idxId = headers.indexOf("id");
      var idxStudentId = headers.indexOf("studentId");
      var idxStudentName = headers.indexOf("studentName");
      var idxStudentEmail = headers.indexOf("studentEmail");
      var idxTimestamp = headers.indexOf("timestamp");
      var idxConfidence = headers.indexOf("confidence");
      var idxClassroom = headers.indexOf("classroom");
      var idxStatus = headers.indexOf("status");
      var idxTemperature = headers.indexOf("temperature");
      var idxHealthStatus = headers.indexOf("healthStatus");
      
      var attendance = [];
      // Skip header row and skip duplicate header rows or literal headers
      for (var i = 1; i < data.length; i++) {
        var row = data[i];
        if (row[0] && String(row[idxId]).toLowerCase() !== "id") {
          attendance.push({
            id: String(row[idxId]),
            studentId: idxStudentId !== -1 ? String(row[idxStudentId]) : "",
            studentName: idxStudentName !== -1 ? String(row[idxStudentName]) : "",
            studentEmail: idxStudentEmail !== -1 ? String(row[idxStudentEmail]) : "",
            timestamp: idxTimestamp !== -1 ? formatDateSafe(row[idxTimestamp]) : "",

            confidence: idxConfidence !== -1 ? Number(row[idxConfidence]) : 100,
            classroom: idxClassroom !== -1 ? String(row[idxClassroom]) : "",
            status: idxStatus !== -1 ? String(row[idxStatus]) : "present",
            temperature: idxTemperature !== -1 && row[idxTemperature] !== "" ? Number(row[idxTemperature]) : undefined,
            healthStatus: idxHealthStatus !== -1 ? String(row[idxHealthStatus]) : undefined
          });
        }
      }
      result = { success: true, attendance: attendance };
      
    } else if (action === "addAttendance") {
      var record = postData.record;
      var headers = attendanceSheet.getRange(1, 1, 1, attendanceSheet.getLastColumn() || 10).getValues()[0];
      var nextRow = attendanceSheet.getLastRow() + 1;
      
      var valuesMap = {
        "id": record.id,
        "studentId": record.studentId,
        "studentName": record.studentName,
        "studentEmail": record.studentEmail,
        "timestamp": record.timestamp || new Date().toISOString(),
        "confidence": record.confidence !== undefined ? Number(record.confidence) : 100,
        "classroom": record.classroom || "",
        "status": record.status || "present",
        "temperature": record.temperature !== undefined && record.temperature !== "" ? Number(record.temperature) : "",
        "healthStatus": record.healthStatus || ""
      };
      
      for (var c = 0; c < headers.length; c++) {
        var header = headers[c];
        if (valuesMap.hasOwnProperty(header)) {
          attendanceSheet.getRange(nextRow, c + 1).setValue(valuesMap[header]);
        }
      }
      result = { success: true };
      
    } else if (action === "getLeaves") {
      var data = leavesSheet.getDataRange().getValues();
      var headers = data[0];
      
      var idxId = headers.indexOf("id");
      var idxStudentId = headers.indexOf("studentId");
      var idxStudentName = headers.indexOf("studentName");
      var idxClassroom = headers.indexOf("classroom");
      var idxStartDate = headers.indexOf("startDate");
      var idxEndDate = headers.indexOf("endDate");
      var idxType = headers.indexOf("type");
      var idxReason = headers.indexOf("reason");
      var idxStatus = headers.indexOf("status");
      var idxSubmittedAt = headers.indexOf("submittedAt");
      
      var leaves = [];
      for (var i = 1; i < data.length; i++) {
        var row = data[i];
        if (row[0] && String(row[idxId]).toLowerCase() !== "id") {
          leaves.push({
            id: String(row[idxId]),
            studentId: idxStudentId !== -1 ? String(row[idxStudentId]) : "",
            studentName: idxStudentName !== -1 ? String(row[idxStudentName]) : "",
            classroom: idxClassroom !== -1 ? String(row[idxClassroom]) : "",
            startDate: idxStartDate !== -1 ? formatDateSafe(row[idxStartDate]) : "",
            endDate: idxEndDate !== -1 ? formatDateSafe(row[idxEndDate]) : "",
            type: idxType !== -1 ? String(row[idxType]) : "personal",
            reason: idxReason !== -1 ? String(row[idxReason]) : "",
            status: idxStatus !== -1 ? String(row[idxStatus]) : "pending",
            submittedAt: idxSubmittedAt !== -1 ? formatDateSafe(row[idxSubmittedAt]) : ""
          });
        }
      }
      result = { success: true, leaves: leaves };
      
    } else if (action === "addLeave") {
      var record = postData.record;
      var headers = leavesSheet.getRange(1, 1, 1, leavesSheet.getLastColumn() || 10).getValues()[0];
      var nextRow = leavesSheet.getLastRow() + 1;
      
      var valuesMap = {
        "id": record.id,
        "studentId": record.studentId,
        "studentName": record.studentName,
        "classroom": record.classroom || "",
        "startDate": record.startDate || "",
        "endDate": record.endDate || "",
        "type": record.type || "personal",
        "reason": record.reason || "",
        "status": record.status || "pending",
        "submittedAt": record.submittedAt || new Date().toISOString()
      };
      
      for (var c = 0; c < headers.length; c++) {
        var header = headers[c];
        if (valuesMap.hasOwnProperty(header)) {
          leavesSheet.getRange(nextRow, c + 1).setValue(valuesMap[header]);
        }
      }
      result = { success: true };
      
    } else if (action === "updateLeaveStatus") {
      var id = postData.id;
      var status = postData.status;
      
      var data = leavesSheet.getDataRange().getValues();
      var headers = leavesSheet.getRange(1, 1, 1, leavesSheet.getLastColumn() || 10).getValues()[0];
      var idxId = headers.indexOf("id");
      var idxStatus = headers.indexOf("status");
      
      var updated = false;
      if (idxId !== -1 && idxStatus !== -1) {
        for (var i = 1; i < data.length; i++) {
          if (String(data[i][idxId]) === String(id)) {
            leavesSheet.getRange(i + 1, idxStatus + 1).setValue(status);
            updated = true;
            break;
          }
        }
      }
      result = { success: updated };
      
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
      
      // Clear data from leaves sheet except headers
      var leavesSheet = ss.getSheetByName("leaves");
      if (leavesSheet) {
        var lastRowLeaves = leavesSheet.getLastRow();
        if (lastRowLeaves > 1) {
          leavesSheet.deleteRows(2, lastRowLeaves - 1);
        }
      }
      
      result = { success: true };
      
    } else if (action === "getSettings") {
      var settingsSheet = ss.getSheetByName("settings");
      if (!settingsSheet) {
        settingsSheet = ss.insertSheet("settings");
        settingsSheet.appendRow(["key", "value"]);
      }
      var data = settingsSheet.getDataRange().getValues();
      var settingsStr = "";
      var schoolLogo = "";
      for (var i = 1; i < data.length; i++) {
        if (data[i][0] === "config") {
          settingsStr = data[i][1];
        } else if (data[i][0] === "schoolLogo") {
          schoolLogo = data[i][1];
        }
      }
      var settingsObj = {};
      if (settingsStr) {
        try {
          settingsObj = JSON.parse(settingsStr);
        } catch(e) {
          console.error("Error parsing settings:", e);
        }
      }
      if (schoolLogo) {
        settingsObj.schoolLogo = schoolLogo;
      }
      result = { success: true, settings: settingsObj };
      
    } else if (action === "saveSettings") {
      var settingsSheet = ss.getSheetByName("settings");
      if (!settingsSheet) {
        settingsSheet = ss.insertSheet("settings");
        settingsSheet.appendRow(["key", "value"]);
      }
      var settings = postData.settings || {};
      var schoolLogo = settings.schoolLogo || "";
      
      // Delete schoolLogo from settings object to keep config cell size small
      delete settings.schoolLogo;
      
      var settingsStr = JSON.stringify(settings);
      var data = settingsSheet.getDataRange().getValues();
      var foundRow = -1;
      var foundLogoRow = -1;
      for (var i = 1; i < data.length; i++) {
        if (data[i][0] === "config") {
          foundRow = i + 1;
        } else if (data[i][0] === "schoolLogo") {
          foundLogoRow = i + 1;
        }
      }
      
      if (foundRow !== -1) {
        settingsSheet.getRange(foundRow, 2).setValue(settingsStr);
      } else {
        settingsSheet.appendRow(["config", settingsStr]);
      }
      
      if (foundLogoRow !== -1) {
        settingsSheet.getRange(foundLogoRow, 2).setValue(schoolLogo);
      } else {
        settingsSheet.appendRow(["schoolLogo", schoolLogo]);
      }
      result = { success: true };
    }
    
  } catch (error) {
    result.error = error.toString();
  }
  
  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

function formatDateSafe(val) {
  if (!val) return "";
  if (val instanceof Date) {
    try {
      return val.toISOString();
    } catch(e) {
      return "";
    }
  }
  return String(val);
}
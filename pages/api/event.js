import { auth, db } from '../../firebaseConfig';
import { collection, getDocs, doc, setDoc, getDoc, addDoc, updateDoc } from 'firebase/firestore';
import * as Notifications from 'expo-notifications';

const createEvent = async (date, endDate, eventDesc, materials, shifts, title, location, category, notifs ) => {
    try {
    var materialsObj = []
    var shiftIDS = []
    materials.forEach(mat => {
        materialsObj.push({item: mat["name"], user: ""});
    });
    for (let i = 0; i < shifts.length; i++) {
        const shift = shifts[i];
        if (shift["end"] && shift["start"]) {
            const docRef = await addDoc(collection(db, "shifts"), {
                endTime: parseInt(shift["end"]),
                startTime: parseInt(shift["start"]),
                user: []
            });
            console.log(docRef.id);
            shiftIDS.push(docRef.id);
        }
    }
    console.log(shiftIDS)
    const data = {
      date: date,
      endDate: endDate == "End Day, Date" ? "null": endDate,
      description: eventDesc,
      location: location,
      materials: materialsObj,
      shifts: shiftIDS,
      title: title,
      category: category,
      notifs: notifs
    };
    const doc = await addDoc(collection(db, "events"), data);
    return doc;
  } catch (error) {
    console.error("Event Creation Error:", error);
    throw error;
  }
};


const editEvent = async (eventId, eventStart, eventEnd, eventDesc, materials, shifts, title, location, category, notfis) => {
  try {
    const eventRef = doc(db, "events", eventId);
    const eventDoc = await getDoc(eventRef);

    if (!eventDoc.exists()) {
      throw new Error("Event not found");
    }

    const eventData = eventDoc.data();
    const existingShiftIds = new Set(eventData.shifts || []);
    const existingMaterials = eventData.materials || [];

    const materialsObj = existingMaterials.map(mat => ({ item: mat.item, user: mat.user }));
    materials.forEach(mat => {
      if (!materialsObj.some(m => m.item === mat.name)) {
        materialsObj.push({ item: mat.name, user: "" });
      }
    });

    const shiftIDS = [...existingShiftIds];

    for (const shift of shifts) {
      if (shift.id && existingShiftIds.has(shift.id)) {
        // Update the already existing shift
        const shiftRef = doc(db, "shifts", shift.id);
        await updateDoc(shiftRef, {
          endTime: parseInt(shift.end),
          startTime: parseInt(shift.start),
        });
      } else if (!shift.id) {
        // Create a new shift only if it's not already in the set
        const docRef = await addDoc(collection(db, "shifts"), {
          endTime: parseInt(shift.end),
          startTime: parseInt(shift.start),
          user: [],
        });
        shiftIDS.push(docRef.id);
      }
    }

    const data = {
      date: eventStart,
      endDate: eventEnd,
      description: eventDesc,
      location: location,
      materials: materialsObj,
      shifts: shiftIDS,
      title: title,
      category: category,
      notfis: notfis || [],
    };

    // Notify users about event update
    await getUserNotifTokens([...existingShiftIds], title, eventId);

    await updateDoc(eventRef, data);
  } catch (error) {
    console.error("Event Update Error:", error);
    throw error;
  }
};

const getUserNotifTokens = async (shiftIds, title, eventId) => {
  try {
    for (const shiftId of shiftIds) {
      const shiftDocRef = doc(db, "shifts", shiftId);
      const shiftDocSnap = await getDoc(shiftDocRef);

      if (!shiftDocSnap.exists()) {
        console.log("No such document!");
        continue;
      }

      const shiftData = shiftDocSnap.data();
      const userId = shiftData.user;

      if (userId && userId.length > 0) {
        for (const uid of userId) {
          const userDocRef = doc(db, "users", uid);
          const userDocSnap = await getDoc(userDocRef);

          if (!userDocSnap.exists()) {
            console.log("No such document!");
            continue;
          }

          const userData = userDocSnap.data();
          const notifToken = userData.notifToken;
          sendPushNotification(notifToken, uid, "Event Update", "an event you are signed up for has been updated: "+ title)
          console.log(`User ID: ${uid}, Notification Token: ${notifToken}`);
        }
      }
    }
  } catch (error) {
    console.error("Error getting user notification tokens: ", error);
  }
};

async function scheduleNotif(title, body, trigger, eventId) {
  const identifier = await Notifications.scheduleNotificationAsync({
    content: {
      title: title,
      body: body,
    },
    trigger
  });
  createNotificationUserStore(auth.currentUser.uid, body, eventId, identifier)
}

async function sendPushNotification(notiToken, uid, title, body) {
  console.log(notiToken)
  const url = "https://exp.host/--/api/v2/push/send";
  const payload = {
    to: notiToken,
    title: title,
    body: body
  };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    createNotificationUserStore(uid, body)
    const data = await response.json();
    console.log("Push notification sent successfully:", data);
  } catch (error) {
    console.error("Error sending push notification:", error);
  }
}

async function createNotificationUserStore(uid, description, eventId = "", identifier = "") {
  const notificationsCollection = collection(db, 'notifications');
  const notificationData = {
    description: description,
    date: Date.now(),
    eventId: eventId,
    identifier: identifier
  };

  try {
    const notiDocRef = await addDoc(notificationsCollection, notificationData);
    
    const userDocRef = doc(db, "users", uid);
    const userDocSnap = await getDoc(userDocRef);

    if (userDocSnap.exists()) {
      let userData = userDocSnap.data();
      let notifications = userData.notifications || [];
      notifications.push(notiDocRef.id);
      
      await updateDoc(userDocRef, {
        notifications: notifications
      });
      
      console.log("A New Document Field has been added to an existing document");
    } else {
      console.log("No such document!");
    }
  } catch (error) {
    console.log(error);
  }
}

const getShiftData = async (shiftList) => {
  try {

    var shiftData = []
  for (let i = 0; i < shiftList.length; i++) {
      const docRef = doc(db, "shifts", shiftList[i]);
      const docSnap = await getDoc(docRef);
      shiftData.push(docSnap.data());
  }
  console.log("hi my name is anirudh")
    console.log(shiftData)
    return(shiftData);
} catch (error) {
  console.error("Event Creation Error:", error);
  throw error;
}
};

export { createEvent, editEvent, getShiftData, sendPushNotification, scheduleNotif };

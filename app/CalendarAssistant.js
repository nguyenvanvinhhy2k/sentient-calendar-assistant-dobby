"use client";
import { useState, useEffect } from "react";
import { Calendar, momentLocalizer } from "react-big-calendar";
import moment from "moment";
import { GoogleLogin } from "@react-oauth/google";
import { jwtDecode } from "jwt-decode";
import emailjs from "emailjs-com";

import "react-big-calendar/lib/css/react-big-calendar.css";
import "moment/locale/en-gb"; 
moment.locale("en");
const localizer = momentLocalizer(moment);

export default function CalendarAssistant() {
  const [events, setEvents] = useState([]);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [showPopup, setShowPopup] = useState(false);
  const [showPopupEdit, setShowPopupEdit] = useState(false);
  const [toast, setToast] = useState(null);
  const [editingEvent, setEditingEvent] = useState(null);
  const [user, setUser] = useState(null);


  const [form, setForm] = useState({
    id: Date.now(),
    title: "",
    start: "",
    end: "",
    notify: false,
  });
  console.log('localizer', localizer)

  const handleSend = async () => {
    const userMsg = { sender: "user", text: input };
    setMessages((prev) => [...prev, userMsg]);

    const res = await fetch("https://api.fireworks.ai/inference/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.NEXT_PUBLIC_FIREWORKS_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "accounts/sentientfoundation/models/dobby-unhinged-llama-3-3-70b-new",
        max_tokens: 1024,
        temperature: 0.5,
        top_p: 0.95,
        messages: [
          {
            role: "system",
            content: "Bạn là một bot quản lý lịch."
          },
          {
            role: "user",
            content: `Bạn là một trợ lý quản lý lịch trình thông minh.

Nhiệm vụ: hiểu câu lệnh của người dùng và trả về **JSON THUẦN** mô tả hành động họ muốn (thêm / sửa / xóa / liệt kê sự kiện lịch).
Nếu không nói rõ tháng → mặc định tháng **10**.  

---

### Format bắt buộc:
{
  "action": "add" | "update" | "delete" | "list",
  "events": [
    { id: "string", "title": "string", "start": "YYYY-MM-DDTHH:mm:ss", "end": "YYYY-MM-DDTHH:mm:ss" }
  ],
  "old": { id: "string", "title": "string", "start": "YYYY-MM-DDTHH:mm:ss", "end": "YYYY-MM-DDTHH:mm:ss" },
  "new": { id: "string", "title": "string", "start": "YYYY-MM-DDTHH:mm:ss", "end": "YYYY-MM-DDTHH:mm:ss" }
}

---

### Quy tắc xử lý "title":

1. Nếu người dùng nói hành động “Đặt lịch”, “Tạo lịch”, “Đặt họp”, “Lên lịch”, “Cuộc họp”, "Xoá", "Huỷ", "Thay đổi", "Cập nhật" →  
   ➤ Chỉ giữ lại phần ý chính của tiêu đề, cụ thể là danh từ trong câu (ví dụ:  
   - “Đặt họp với Minh” → "họp với Minh"
   - “Tạo lịch hẹn với Hùng” → "hẹn với Hùng")

2. Nếu người dùng **tự nêu rõ tên sự kiện cụ thể** như “Meeting”, “Coffee break”, “Dinner”, “Team meeting”, “Presentation”, v.v.  
   ➤ Giữ nguyên nguyên văn, không rút gọn.  
   (ví dụ:  
   - “Meeting thứ 4 lúc 2h” → "Meeting"  
   - “Coffee break với Hùng” → "Coffee break với Hùng")

3. Nếu không nói rõ năm → mặc định năm **2025**.  
4. Nếu không nói rõ tháng → mặc định tháng **10**.  
5. Nếu không nêu thời lượng → mặc định sự kiện kéo dài **60 phút**.  
6. Nếu không nói rõ giờ → mặc định giờ **12**.  
7. Khi hành động là "delete" → chỉ cần "title" và "start".
8. **Nếu người dùng muốn xoá lịch:**
   - Hiểu theo ngữ nghĩa mở rộng.
     - “xoá coffee” → xoá các lịch có từ “coffee” trong title, ví dụ “Coffee break với Hùng”.
     - “xoá coffee với Mi” → nếu không có “Mi”, nhưng có “coffee với Hùng”, hãy hiểu đó là cùng một sự kiện (vì có từ khóa “coffee”).
     - “xoá shopping và gym” → xoá cả hai loại sự kiện đó nếu có.
     - “xoá họp” → xoá mọi lịch có “họp”, “meeting” hoặc “họp với ai đó”.
---

### Ví dụ đúng:

Người dùng: “Đặt họp với Minh thứ 4 lúc 2h và với Hùng thứ 5 lúc 2h”  
Trường id được thêm mặc định vào mỗi object trong events và là 1 dãy chữ số ngẫu nhiêm.
→
{
  "action": "add",
  "events": [
    { "id": "3fsd2","title": "họp với Minh", "start": "2025-10-08T14:00:00", "end": "2025-10-08T15:00:00" },
    { "id": "f3fsd","title": "họp với Hùng", "start": "2025-10-09T14:00:00", "end": "2025-10-09T15:00:00" }
  ]
}

Người dùng: “Meeting thứ 4 lúc 2h và Coffee break với Hùng thứ 5”  
Trường id được thêm mặc định vào mỗi object trong events và là 1 dãy chữ số ngẫu nhiêm.
→
{
  "action": "add",
  "events": [
    { "id": "sd32","title": "Meeting", "start": "2025-10-08T14:00:00", "end": "2025-10-08T15:00:00" },
    { "id": "fsd3","title": "Coffee break với Hùng", "start": "2025-10-09T14:00:00", "end": "2025-10-09T15:0:00" }
  ]
}

            Yêu cầu: ${input}
            `
          },
        ],
      }),
    });

    const data = await res.json();
    const text = JSON.parse(data.choices[0].message.content) || "";

    console.log('text', text)

    try {
      // const eventObj = safeParse(text);
      const data = convertBotEvents(text.events)
      const action = text.action
      console.log('data', data)

      if (data) {
        // Cập nhật Calendar
        if (action === "add") {
          setEvents(prev => [...prev, ...data]);
        }
    
        // 🔹 Xoá sự kiện
        if (action === "delete") {
          setEvents(prev =>
            prev.filter(ev =>
              data.every(delEv => {
                const evMonth = new Date(ev.start).getMonth();
                const delMonth = new Date(delEv.start).getMonth();
          
                const isSameTitle =
                  ev.title.trim().toLowerCase() === delEv.title.trim().toLowerCase();
                const isSameMonth = evMonth === delMonth;
          
                // Giữ lại những event KHÔNG trùng title + tháng
                return !(isSameTitle && isSameMonth);
              })
            )
          );
        }
        
        if (action === "update") {
          setEvents(prev => {
            if (!Array.isArray(prev)) return prev; // tránh lỗi map khi prev undefined
            if (!data?.old || !data?.new) return prev;
          
            const newEvents = [...prev];
            const old = data.old;
            const newEvent = data.new;
          
            // tìm vị trí event cũ khớp title + tháng
            const index = newEvents.findIndex(ev => {
              const sameTitle =
                ev.title.trim().toLowerCase() === old.title.trim().toLowerCase();
              const sameMonth =
                new Date(ev.start).getMonth() === new Date(old.start).getMonth();
              return sameTitle && sameMonth;
            });
          
            if (index !== -1) {
              newEvents[index] = {
                ...newEvents[index],
                ...newEvent,
                start: newEvent.start,
                end: newEvent.end,
              };
            }
          
            return newEvents;
          });};

        setMessages((prev) => [
          ...prev,
          { sender: "bot", text: `Calendar  ${action === "added" ? "thêm" : action === "delete" ? "deleted " : "updated"} successfully` }
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          { sender: "bot", text: "Sorry, I don't understand this schedule." }
        ]);
      }
    } catch (err) {
      console.error("Parse error", err);
    }
    setInput("");
  };

  // function handleBotAction(botResponse) {
  //   console.log('bot', botResponse)
  //   const { action, events } = botResponse;


  //   if (action === "add") {
  //     setEvents(prev => [...prev, ...events]);
  //   }

  //   if (action === "delete") {
  //     setEvents(prev =>
  //       prev.filter(ev =>
  //         botResponse.every(delEv => {
  //           const sameTitle = ev.title !== delEv.title;
  //           const sameStart =
  //             new Date(ev.start).getTime() !== new Date(delEv.start).getTime();
  //           return sameTitle || sameStart;
  //         })
  //       )
  //     );
  //   }

  //   // 🔹 Cập nhật sự kiện
  //   if (action === "update") {
  //     setEvents(prev =>
  //       prev.map(ev => {
  //         const old = botResponse.old;
  //         if (
  //           ev.title === old.title &&
  //           new Date(ev.start).getTime() === new Date(old.start).getTime()
  //         ) {
  //           return {
  //             ...botResponse.new,
  //             start: new Date(botResponse.new.start),
  //             end: new Date(botResponse.new.end),
  //           };
  //         }
  //         return ev;
  //       })
  //     );
  //   }

  //   // 🔹 Xem danh sách
  //   if (action === "list") {
  //     console.log("📅 Current events:", events);
  //   }
  // }


  function convertBotEvents(botEvents) {
    return botEvents.map(ev => {
      const startDate = new Date(ev.start);
      const endDate = new Date(ev.end);

      return {
        id: ev.id,
        title: ev.title,
        start: new Date(
          startDate.getFullYear(),
          startDate.getMonth(),
          startDate.getDate(),
          startDate.getHours(),
          startDate.getMinutes()
        ),
        end: new Date(
          endDate.getFullYear(),
          endDate.getMonth(),
          endDate.getDate(),
          endDate.getHours(),
          endDate.getMinutes()
        )
      };
    });
  }

  useEffect(() => {
    const saved = localStorage.getItem("calendarEvents");
    if (saved) {
      const parsed = JSON.parse(saved).map(ev => ({
        ...ev,
        start: new Date(ev.start),
        end: new Date(ev.end),
      }));
      setEvents(parsed);
    }
  }, []);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };


 // Khi chọn vùng thời gian trống
 const handleSelectSlot = ({ start, end }) => {
  setForm({ id: "", title: "", start, end, notify: false });
  setEditingIndex(null);
  setShowManager(true);
};

  // Thêm hoặc cập nhật sự kiện
  const handleSaveAdd = () => {
    if (!form.title.trim()) {
      showToast("⚠️ Please enter an calendar title");
      return;
    }

    const newEvent = { ...form, id: Date.now() };
    setEvents((prev) => [...prev, newEvent]);
    showToast("✅ Calendar schedule added");
    setForm({ title: "", start: "", end: "", notify: false });
  };

  const handleSaveEdit = () => {
    if (!form.title.trim()) {
      showToast("⚠️ Please enter an calendar title");
      return;
    }
    if (editingEvent) {
      setEvents((prev) =>
        prev.map((ev) => (ev.id === editingEvent.id ? { ...form, id: ev.id } : ev))
      );
      setEditingEvent(null);
      setShowPopupEdit(false)
      setForm({ title: "", start: "", end: "", notify: false });
      setEditingEvent(null);
      showToast("✅ Updated Calendar schedule");
    }
  };

  // Xoá sự kiện
  const handleDelete = (id) => {
    setEvents((prev) => prev.filter((e) => e.id !== id));
    showToast("🗑️ Calendar deleted");
  };

// Sửa bằng index
const handleEdit = (item) => {
  setEditingEvent(item);
  setForm({
    title: item.title,
    start: moment(item.start).format("YYYY-MM-DDTHH:mm"),
    end: moment(item.end).format("YYYY-MM-DDTHH:mm"),
    notify: item.notify,
  });
  setShowPopupEdit(true)
};

  const handlePopup = () => {
    setShowPopup(true)
  }

  const handleLogout = () => {
    localStorage.removeItem("googleUser");
    setUser(null);
  };

  const sendEmailNotification = async (event) => {
    console.log('event', event, user.email)
    if (!user) return;

    try {
      await fetch("https://hook.eu2.make.com/tudnmw9igsl1titf15ggr4fyox4ozp5b", { // URL của bạn
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_id: event.id,
          event_title: event.title,
          event_start: moment(event.start).format("YYYY-MM-DDTHH:mm:ssZ"), // ISO format
          user_email: user.email,
          user_name: user.name,
        }),
      });
      showToast(`📅 Reminder for "${event.title}" scheduled!`);
    } catch (err) {
      console.error(err);
      showToast("⚠️ Failed to schedule reminder.");
    }
  };

  const handleToggleNotify = (index) => {
    if (!user) {
      showToast("⚠️ Please log in to Gmail before turning on notifications.");
      return;
    }

    const updated = [...events];
    updated[index].notify = !updated[index].notify;
    setEvents(updated);

    if (updated[index].notify) {
      showToast(`✅ Notifications enabled for: ${updated[index].title}`);
      sendEmailNotification(updated[index]);
    } else {
      showToast(`🔕 Notifications turned off for: ${updated[index].title}`);
    }
  };

  useEffect(() => {
    localStorage.setItem("calendarEvents", JSON.stringify(events));
  }, [events]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedUser = localStorage.getItem("googleUser");
      if (savedUser) setUser(JSON.parse(savedUser));
    }
  }, []);

  return (
<div className="flex h-screen bg-gray-50 font-sans flex-col sm:flex-row">
      {/* Calendar */}
      <div className="flex-[2] p-3">
        <div className="h-full bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <Calendar
            localizer={localizer}
            events={events}
            startAccessor="start"
            endAccessor="end"
            selectable
            onSelectSlot={handleSelectSlot}
            onSelectEvent={handlePopup}
            style={{ height: "100%" }}
          />
        </div>
      </div>

      {/* Chat */}
      <div className="flex-[1] flex flex-col border-l border-gray-200 bg-white shadow-inner">
  {/* 🧠 Giới thiệu trợ lý */}
  <div className="flex justify-between border-gray-200 bg-blue-50 items-center"> 
    <div className="p-4 border-b flex items-center gap-3 w-[80%]">
    <img
      src="https://sentient-synthetic.vercel.app/_next/static/media/dobby-mess.c55e1a60.png"
      alt="Bot Avatar"
      className="w-10 h-10 rounded-full"
    />
    <div>
      <h2 className="text-lg font-semibold text-blue-700">Dobby Calendar Assistant</h2>
      <p className="text-sm text-gray-600">Always ready to help you manage your schedule</p>
    </div>
  </div>
  <div className="w-[15%] h-full flex items-center mr-[10px] flex-row-reverse">
  <img className="w-[50px] h-[50px] rounded-full p" src="https://pbs.twimg.com/profile_images/1966252290500710400/iacpKDQc_400x400.jpg" />
  </div>
  </div>
 

  {/* 💬 Danh sách tin nhắn */}
  <div className="flex-1 overflow-y-auto p-3 space-y-3">
    {messages.map((m, i) => (
      <div
        key={i}
        className={`flex ${m.sender === "user" ? "justify-end" : "justify-start"}`}
      >
        {m.sender !== "user" && (
          <img
            src="https://cdn-icons-png.flaticon.com/512/4712/4712109.png"
            alt="Bot Avatar"
            className="w-8 h-8 rounded-full mr-2 self-end"
          />
        )}

        <div
          className={`px-4 py-2 rounded-2xl max-w-[75%] leading-relaxed ${
            m.sender === "user"
              ? "bg-blue-600 text-white rounded-br-none"
              : "bg-gray-100 text-gray-800 rounded-bl-none"
          }`}
        >
          {m.text}
        </div>
      </div>
    ))}
  </div>

  {/* 📝 Ô nhập tin nhắn */}
  <div className="py-2 px-3 border-t border-gray-200 flex items-end gap-2 relative">
  {/* Textarea nhập tin nhắn */}
  <textarea
    value={input}
    onChange={(e) => setInput(e.target.value)}
    placeholder="Enter a message..."
    rows={2}
    className="flex-1 resize-none px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
    onKeyDown={(e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    }}
  />

  {/* Nút Send + Hướng dẫn */}
  <div className="flex flex-col items-center gap-1 relative">
    {/* Nút Hướng dẫn */}
    <div className="group relative">
      <button className="p-1 text-gray-500 hover:text-blue-600">
        ❔
      </button>

      {/* Tooltip hướng dẫn */}
      <div className="absolute bottom-full right-[10px] mb-2 w-[480px] text-sm text-gray-700 bg-white border border-gray-200 rounded-lg shadow-lg p-3 opacity-0 group-hover:opacity-100 pointer-events-none transition">
  <div className="font-semibold mb-1">💡 Instruct:</div>
  <div className="space-y-1">
    <div> You can add, cancel, and manage calendar by sending requests to Dobby Calendar Assistant.</div>
    <div> For example: Schedule a trip on the 12th at 8am and shopping on the 14th from 3pm to 5pm.</div>
    <div> Example: Cancel Shopping on the 14th</div>
    <div> Click on any appointment to manage it</div>
    <div> If <b>year</b> is not specified → default year <b>2025</b>.</div>
    <div> If <b>month</b> is not specified → default month <b>10</b>.</div>
    <div> If <b>duration</b> is not specified → default event duration is <b>60 minutes</b>.</div>
    <div> If <b>hour</b> is not specified → default hour <b>12</b>.</div>
  </div>
</div>
    </div>

    {/* Nút Send */}
    <button
      onClick={handleSend}
      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
    >
      Send
    </button>
  </div>
</div>

</div>



      {/* Popup thêm/sửa */}
      {showPopup && (
   <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
   <div className="bg-white rounded-2xl w-[45%] max-h-[85vh] p-6 shadow-2xl overflow-y-auto animate-fadeIn border border-gray-100">
     {/* Header */}
     <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-gray-700">
            📅 Manage Calendar
          </h2>
          <div className="flex items-center gap-3">
            {user ? (
              <div className="flex items-center gap-2 bg-green-50 px-3 py-1 rounded-lg">
                <img
                  src={user.picture}
                  alt="avatar"
                  className="w-6 h-6 rounded-full border"
                />
                <span className="text-sm text-gray-700">{user.email}</span>
                <button
                  onClick={handleLogout}
                  className="text-red-500 hover:underline text-xs ml-1"
                >
                  Logout
                </button>
              </div>
            ) : (
              <GoogleLogin
                onSuccess={(credentialResponse) => {
                  const decoded = jwtDecode(credentialResponse.credential);
                  const userData = {
                    name: decoded.name,
                    email: decoded.email,
                    picture: decoded.picture,
                  };
                  localStorage.setItem("googleUser", JSON.stringify(userData));
                  setUser(userData);
                }}
                onError={() => showToast("Gmail login failed!")}
              />
            )}

            <button
              onClick={() => setShowPopup(false)}
              className="text-gray-500 hover:text-gray-800 text-xl transition ml-[10px]"
            >
              ✕
            </button>
          </div>
        </div>
 
     {/* Form thêm/sửa */}
     <div className="flex flex-wrap gap-3 mb-6 items-center">
       <input
         type="text"
         placeholder="Appointment title"
         onChange={(e) => setForm({ ...form, title: e.target.value })}
         className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
       />
 
       <input
         type="datetime-local"
         onChange={(e) => setForm({ ...form, start: e.target.value })}
         className="border border-gray-300 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
       />
 
       <input
         type="datetime-local"
         onChange={(e) => setForm({ ...form, end: e.target.value })}
         className="border border-gray-300 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
       />
 
       <button
         onClick={handleSaveAdd}
         className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 active:scale-95 transition"
       >
         {editingEvent ? "💾 Update" : "➕ Add"}
       </button>
     </div>
 
     {/* Danh sách lịch hẹn */}
     <div className="border-t border-gray-200">
       <table className="w-full text-sm">
         <thead className="sticky top-0 bg-gray-50 border-b text-gray-600">
           <tr>
             <th className="py-2 text-left">Title</th>
             <th className="py-2 text-left">Time</th>
             <th className="py-2 text-left">Notification</th>
             <th className="py-2 text-right pr-2">Act</th>
           </tr>
         </thead>
         <tbody>
           {events.length > 0 ? (
             events.map((ev, index) => (
               <tr
                 key={index}
                 className="border-b hover:bg-blue-50/50 transition"
               >
                 <td className="py-2 font-medium text-gray-800">
                   {ev.title || "No title"}
                 </td>
                 <td className="text-gray-600">
                   {moment(ev.start).format("DD/MM HH:mm")} –{" "}
                   {moment(ev.end).format("DD/MM HH:mm")}
                 </td>
                 <td>
                 <button
                  onClick={() => handleToggleNotify(index)}
                  className={`px-3 py-1 rounded-lg text-sm font-medium ${
                    ev.notify
                      ? "bg-green-100 text-green-700 border border-green-400"
                      : "bg-gray-100 text-gray-700 border border-gray-300"
                  }`}
                >
                  {ev.notify ? "🔔 On" : "🚫 Off"}
                </button>
                </td>
                 <td className="text-right space-x-3 pr-2">
                   <button
                     onClick={() => handleEdit(ev)}
                     className="text-blue-600 hover:underline font-medium"
                   >
                     Edit
                   </button>
                   <button
                     onClick={() => handleDelete(ev.id)}
                     className="text-red-600 hover:underline font-medium"
                   >
                     Remove
                   </button>
                 </td>
               </tr>
             ))
           ) : (
             <tr>
               <td colSpan={4} className="text-center py-6 text-gray-400">
               There are no appointments scheduled yet 📭
               </td>
             </tr>
           )}
         </tbody>
       </table>
     </div>
   </div>
 </div>
 
      )}

{showPopupEdit && (
  <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[999] animate-fadeIn">
    <div className="relative w-[50%] max-w-2xl bg-gradient-to-br from-blue-950/70 via-indigo-900/60 to-purple-900/70 border border-white/20 rounded-2xl shadow-2xl text-white p-6 animate-scaleIn">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-xl font-semibold tracking-wide">
          Edit Appointment
        </h3>
        <button
          onClick={() => setShowPopupEdit(false)}
          className="text-white/70 hover:text-white text-2xl leading-none"
        >
          ×
        </button>
      </div>

      {/* Form */}
      <div className="grid grid-cols-2 gap-4 mb-5">
        <input
          type="text"
          placeholder="Event title"
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          className="col-span-2 bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-indigo-400"
        />
        <input
          type="datetime-local"
          value={form.start}
          onChange={(e) => setForm({ ...form, start: e.target.value })}
          className="bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
        />
        <input
          type="datetime-local"
          value={form.end}
          onChange={(e) => setForm({ ...form, end: e.target.value })}
          className="bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
        />
      </div>


        <button
          onClick={handleSaveEdit}
          className={`px-5 py-2 rounded-lg font-semibold tracking-wide transition-all duration-300 shadow-md ${
            editingEvent
              ? "bg-gradient-to-r from-yellow-400 to-orange-500 hover:scale-105"
              : "bg-gradient-to-r from-indigo-500 to-purple-500 hover:scale-105"
          }`}
        >
          Update
        </button>

      {/* Decorative glow */}
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-tr from-indigo-500/10 via-purple-500/10 to-transparent pointer-events-none blur-2xl"></div>
    </div>
  </div>
)}


      {/* Toast thông báo */}
      {toast && (
        <div className="fixed bottom-5 right-5 bg-gray-900 text-white px-4 py-2 rounded-lg shadow-md text-sm animate-fadeIn z-[999]">
          {toast}
        </div>
      )}
    </div>
  );
}


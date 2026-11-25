"use client";

// Physical room inventory for one hotel. Bookings are always made for a real
// room, so a hotel needs at least one active room before it can be reserved.
import "../../amenities/amenities.css";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Swal from "sweetalert2";
import { FaPlus, FaEdit, FaTrash, FaSave, FaTimes } from "react-icons/fa";
import { getHotel } from "@/services/hotel.service";
import { createRoom, deleteRoom, listRooms, updateRoom } from "@/services/room.service";

const BUTTON_COLOR = "#0866ed";
const EMPTY = { roomNumber: "", roomType: "Standard", pricePerNight: "", capacity: 2, status: "active" };

export default function HotelRoomsPage() {
  const { id } = useParams();

  const [hotel, setHotel] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);

  const notify = (icon, title, text) =>
    Swal.fire({ icon, title, text, confirmButtonColor: BUTTON_COLOR });

  const load = useCallback(async () => {
    try {
      const [found, list] = await Promise.all([getHotel(id), listRooms(id)]);
      setHotel(found);
      setRooms(list);
    } catch (error) {
      console.error(error);
      notify("error", "Error", "Unable to load rooms.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const clearForm = () => {
    setForm(EMPTY);
    setEditingId(null);
  };

  const save = async () => {
    if (!form.roomNumber.trim()) {
      notify("error", "Error", "Room number is required.");
      return;
    }

    try {
      if (editingId) await updateRoom(editingId, form);
      else await createRoom(id, form);

      notify("success", "Success", editingId ? "Room updated." : "Room added.");
      clearForm();
      load();
    } catch (error) {
      notify("error", "Error", "Unable to save the room. Check that the room number is unique.");
    }
  };

  const edit = (room) => {
    setEditingId(room.id);
    setForm({
      roomNumber: room.roomNumber,
      roomType: room.roomType,
      pricePerNight: room.pricePerNight ?? "",
      capacity: room.capacity,
      status: room.status,
    });
  };

  const remove = async (room) => {
    const confirm = await Swal.fire({
      icon: "warning",
      title: "Delete room?",
      text: `Room ${room.roomNumber} will be removed.`,
      showCancelButton: true,
      confirmButtonColor: BUTTON_COLOR,
    });
    if (!confirm.isConfirmed) return;

    try {
      await deleteRoom(room.id);
      load();
    } catch (error) {
      notify("error", "Error", "This room has bookings. Set it to inactive instead.");
    }
  };

  const set = (key) => (e) => setForm((previous) => ({ ...previous, [key]: e.target.value }));

  return (
    <div className="amenity-page content-wrapper">
      <div className="page-header">
        <h1>Rooms{hotel ? ` — ${hotel.hotelName}` : ""}</h1>
        <p>
          Each room is one bookable unit. Leave the price empty to use the hotel&apos;s price.{" "}
          <Link href="/superadmin/hotels/allhotels">Back to hotels</Link>
        </p>
      </div>

      <div className="amenity-card">
        <div className="form-grid">
          <input type="text" placeholder="Room number" value={form.roomNumber} onChange={set("roomNumber")} />
          <input type="text" placeholder="Room type" value={form.roomType} onChange={set("roomType")} />
          <input type="number" min="0" placeholder="Price per night" value={form.pricePerNight} onChange={set("pricePerNight")} />
          <input type="number" min="1" max="20" placeholder="Capacity" value={form.capacity} onChange={set("capacity")} />
          <select value={form.status} onChange={set("status")}>
            <option value="active">Active</option>
            <option value="maintenance">Maintenance</option>
            <option value="inactive">Inactive</option>
          </select>
          <button className="save-btn" onClick={save}>
            {editingId ? (<><FaSave /> Update</>) : (<><FaPlus /> Add Room</>)}
          </button>
          {editingId && (
            <button className="cancel-btn" onClick={clearForm}>
              <FaTimes /> Cancel
            </button>
          )}
        </div>
      </div>

      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Room</th>
              <th>Type</th>
              <th>Price / night</th>
              <th>Capacity</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="6">Loading...</td></tr>
            ) : rooms.length === 0 ? (
              <tr><td colSpan="6">No rooms yet. Add at least one room so guests can book this hotel.</td></tr>
            ) : (
              rooms.map((room) => (
                <tr key={room.id}>
                  <td>{room.roomNumber}</td>
                  <td>{room.roomType}</td>
                  <td>{room.pricePerNight ?? "Hotel price"}</td>
                  <td>{room.capacity}</td>
                  <td><span className={room.status === "active" ? "active" : ""}>{room.status}</span></td>
                  <td>
                    <div className="actions">
                      <button className="edit" onClick={() => edit(room)}><FaEdit /></button>
                      <button className="delete" onClick={() => remove(room)}><FaTrash /></button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

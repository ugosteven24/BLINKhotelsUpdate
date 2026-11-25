"use client";

import "./guest.css";

import { useEffect, useState } from "react";
import Link from "next/link";



import {
    FaSearch,
    FaEye,
    FaTrash,
    FaBan,
    FaCheckCircle,
} from "react-icons/fa";
import Swal from "sweetalert2";
import { deleteUser, listUsers, setUserStatus } from "@/services/user.service";

const BUTTON_COLOR = "#2563eb";


export default function Guests() {

    const [guests, setGuests] = useState([]);
    const [search, setSearch] = useState("");


    useEffect(() => {
        loadGuests();
    }, []);

    const loadGuests = async () => {

        const snapshot = await listUsers();

        const data = snapshot
            .filter(user => user.role === "client");

        setGuests(data);

    };

    const toggleStatus = async (guest) => {

        const status =
            guest.status === "Active"
                ? "Blocked"
                : "Active";

        await setUserStatus(guest.id, status);
        Swal.fire({
          icon: "success",
          title: "Success",
          text: `Guest ${status}`,
          confirmButtonColor: BUTTON_COLOR,
        });

        loadGuests();

    };

    const deleteGuest = async (id) => {

        if (!confirm("Delete this guest?"))
            return;

        await deleteUser(id);

        Swal.fire({
          icon: "success",
          title: "Success",
          text: "Guest deleted",
          confirmButtonColor: BUTTON_COLOR,
        });

        loadGuests();

    };

    const filtered = guests.filter(item =>
        item.fullName
            ?.toLowerCase()
            .includes(search.toLowerCase()) ||
        item.email
            ?.toLowerCase()
            .includes(search.toLowerCase())
    );

    return (

        <div className="guest-page content-wrapper">


            <div className="page-header">

                <h1>Guests</h1>

                <p>
                    Manage all registered guests.
                </p>

            </div>

            <div className="toolbar">

                <div className="search-box">

                    <FaSearch />

                    <input
                        type="text"
                        placeholder="Search guest..."
                        value={search}
                        onChange={(e) =>
                            setSearch(e.target.value)
                        }
                    />

                </div>

            </div>

            <div className="table-wrapper">

                <table>

                    <thead>

                        <tr>

                            <th>Photo</th>
                            <th>Name</th>
                            <th>Email</th>
                            <th>Phone</th>
                            <th>Location</th>
                            <th>Status</th>
                            <th>Actions</th>

                        </tr>

                    </thead>

                    <tbody>

                        {filtered.length === 0 ? (

                            <tr>

                                <td colSpan="7">

                                    No guests found.

                                </td>

                            </tr>

                        ) : (

                            filtered.map(guest => (

                                <tr key={guest.id}>

                                    <td>

                                        <img
                                            src={
                                                guest.photo ||
                                                "/images/avatar.png"
                                            }
                                            className="avatar"
                                            alt=""
                                        />

                                    </td>

                                    <td>
                                        {guest.fullName}
                                    </td>

                                    <td>
                                        {guest.email}
                                    </td>

                                    <td>
                                        {guest.phone}
                                    </td>

                                    <td>

                                        {guest.city},{" "}
                                        {guest.state}

                                    </td>

                                    <td>

                                        <span
                                            className={
                                                guest.status === "Active"
                                                    ? "active"
                                                    : "blocked"
                                            }
                                        >

                                            {guest.status}

                                        </span>

                                    </td>

                                    <td>

                                        <div className="actions">

                                            <Link
                                                href={`/superadmin/users/guests/${guest.id}`}
                                                className="view"
                                            >

                                                <FaEye />

                                            </Link>

                                            <button
                                                className="status"
                                                onClick={() =>
                                                    toggleStatus(
                                                        guest
                                                    )
                                                }
                                            >

                                                {guest.status ===
                                                "Active" ? (
                                                    <FaBan />
                                                ) : (
                                                    <FaCheckCircle />
                                                )}

                                            </button>

                                            <button
                                                className="delete"
                                                onClick={() =>
                                                    deleteGuest(
                                                        guest.id
                                                    )
                                                }
                                            >

                                                <FaTrash />

                                            </button>

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

const API_BASE = "http://localhost:5000/api";
const GROUPS_URL = `${API_BASE}/groups`;
const GOAL_KEY = "studentCircleWeeklyGoal";
const COMPLETED_SESSIONS_KEY = "studentCircleCompletedSessions";

document.addEventListener("DOMContentLoaded", () => {
  highlightActiveNavigation();
  initFindGroupsPage();
  initGroupDetailsPage();
  initMyGroupsPage();
});

// ==============================
// COMMON FUNCTIONS
// ==============================

function highlightActiveNavigation() {
  const currentPage =
    window.location.pathname.split("/").pop() || "index.html";

  document.querySelectorAll(".nav-links a").forEach((link) => {
    link.classList.toggle(
      "active",
      link.getAttribute("href") === currentPage
    );
  });
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function getCurrentUser() {
  try {
    return JSON.parse(
      sessionStorage.getItem("studentCircleUser") || "null"
    );
  } catch {
    return null;
  }
}

function isLoggedIn() {
  const user = getCurrentUser();
  return Boolean(
    sessionStorage.getItem("studentCircleToken") && user?.id
  );
}

function requireLogin() {
  if (isLoggedIn()) return true;

  alert("Please log in to continue.");
  window.location.href = "login.html";
  return false;
}

async function apiRequest(url, options = {}) {
  let response;
  const token = sessionStorage.getItem("studentCircleToken");

  try {
    response = await fetch(url, {
      ...options,
      headers: {
        ...(options.body
          ? { "Content-Type": "application/json" }
          : {}),
        ...(options.headers || {}),
        ...(token
          ? { Authorization: `Bearer ${token}` }
          : {})
      }
    });
  } catch {
    throw new Error(
      "Cannot connect to the backend. Make sure the server is running on port 5000."
    );
  }

  const result = await response.json().catch(() => ({}));

  if (!response.ok || result.success === false) {
    throw new Error(
      result.message || `Request failed (${response.status}).`
    );
  }

  return result;
}

function groupTime(group) {
  return group.schedule || group.time || "Flexible";
}

function groupInitials(name) {
  return String(name || "SC")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0] || "")
    .join("")
    .toUpperCase();
}

function getRequestForCurrentUser(group) {
  const user = getCurrentUser();

  if (!user) return null;

  return (group.joinRequests || []).find((request) => {
    if (request.studentId && user.id) {
      return String(request.studentId) === String(user.id);
    }

    // Compatibility with older requests that have no studentId.
    return (
      (request.studentName || "").trim().toLowerCase() ===
      (user.name || "").trim().toLowerCase()
    );
  }) || null;
}

// ==============================
// FIND GROUPS PAGE
// ==============================

function initFindGroupsPage() {
  const container = document.getElementById("groupsContainer");
  if (!container) return;

  const search = document.getElementById("groupSearch");
  const subjectFilter = document.getElementById("subjectFilter");
  const timeFilter = document.getElementById("timeFilter");
  const resultCount = document.getElementById("resultCount");
  const emptyState = document.getElementById("emptyState");
  const createPanel = document.getElementById("createPanel");
  const createForm = document.getElementById("createGroupForm");

  let groups = [];

  function renderGroups() {
    const query = (search?.value || "").trim().toLowerCase();
    const subject = subjectFilter?.value || "all";
    const time = timeFilter?.value || "all";

    let visible = 0;
    container.replaceChildren();

    groups.forEach((group) => {
      const id = group._id || group.id;
      const title = group.title || group.name || "Study Group";
      const groupSubject = group.subject || "General";
      const description = group.description || "";
      const schedule = groupTime(group);

      const matchesText =
        `${title} ${groupSubject} ${description} ${schedule}`
          .toLowerCase()
          .includes(query);

      const matchesSubject =
        subject === "all" ||
        groupSubject.toLowerCase() === subject.toLowerCase();

      const matchesTime =
        time === "all" ||
        schedule.toLowerCase().includes(time.toLowerCase());

      if (!matchesText || !matchesSubject || !matchesTime) return;

      visible++;

      const approvedCount = (group.joinRequests || []).filter(
        (request) => request.status === "Approved"
      ).length;

      const card = document.createElement("article");
      card.className = "group-card";

      card.innerHTML = `
        <div class="group-card-header">
          <span class="subject-icon">
            ${escapeHTML(groupInitials(title))}
          </span>
          <span class="tag">${escapeHTML(groupSubject)}</span>
        </div>

        <h3>${escapeHTML(title)}</h3>
        <p>${escapeHTML(description)}</p>

        <div class="group-meta">
          <span>👥 ${1 + approvedCount} member(s)</span>
          <span>◷ ${escapeHTML(schedule)}</span>
        </div>

        <a class="button primary full-width"
           href="group-details.html?id=${encodeURIComponent(id)}">
          View Group →
        </a>
      `;

      container.appendChild(card);
    });

    if (resultCount) {
      resultCount.textContent =
        `${visible} study group${visible === 1 ? "" : "s"} found`;
    }

    if (emptyState) {
      emptyState.hidden = visible !== 0;
    }
  }

  async function loadGroups() {
    if (resultCount) {
      resultCount.textContent = "Loading study groups...";
    }

    try {
      const result = await apiRequest(GROUPS_URL);
      groups = Array.isArray(result.data) ? result.data : [];
      renderGroups();
    } catch (error) {
      if (resultCount) {
        resultCount.textContent = "Could not load groups.";
      }

      if (emptyState) {
        emptyState.hidden = false;
        emptyState.textContent = error.message;
      }

      console.error("Load groups error:", error);
    }
  }

  search?.addEventListener("input", renderGroups);
  subjectFilter?.addEventListener("change", renderGroups);
  timeFilter?.addEventListener("change", renderGroups);

  document.getElementById("resetFilters")?.addEventListener("click", () => {
    if (search) search.value = "";
    if (subjectFilter) subjectFilter.value = "all";
    if (timeFilter) timeFilter.value = "all";

    renderGroups();
  });

  document.getElementById("openCreateForm")?.addEventListener("click", () => {
    if (!requireLogin()) return;

    if (createPanel) {
      createPanel.hidden = false;
      createPanel.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    }

    document.getElementById("groupName")?.focus();
  });

  document.getElementById("closeCreateForm")?.addEventListener("click", () => {
    if (createPanel) createPanel.hidden = true;
  });

  createForm?.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!requireLogin()) return;

    const title =
      document.getElementById("groupName")?.value.trim() || "";
    const subject =
      document.getElementById("groupSubject")?.value || "";
    const description =
      document.getElementById("groupDescription")?.value.trim() || "";
    const schedule =
      document.getElementById("groupTime")?.value || "";

    if (!title || !subject || !description || !schedule) {
      alert("Please complete all fields.");
      return;
    }

    const submitButton = createForm.querySelector('[type="submit"]');

    if (submitButton) submitButton.disabled = true;

    try {
      await apiRequest(GROUPS_URL, {
        method: "POST",
        body: JSON.stringify({
          title,
          subject,
          description,
          schedule,
          level: "Beginner",
          maxMembers: 10
        })
      });

      alert("Your study group was created successfully!");

      createForm.reset();

      if (createPanel) createPanel.hidden = true;
      if (search) search.value = "";
      if (subjectFilter) subjectFilter.value = "all";
      if (timeFilter) timeFilter.value = "all";

      await loadGroups();
    } catch (error) {
      alert(error.message);
      console.error("Create group error:", error);
    } finally {
      if (submitButton) submitButton.disabled = false;
    }
  });

  loadGroups();
}

// ==============================
// GROUP DETAILS PAGE
// ==============================

async function initGroupDetailsPage() {
  const nameElement = document.getElementById("detailName");
  if (!nameElement) return;

  const params = new URLSearchParams(window.location.search);
  const groupId = params.get("id");

  const joinButton = document.getElementById("joinButton");
  const joinMessage = document.getElementById("joinMessage");

  if (!groupId) {
    nameElement.textContent = "Study group not found";

    if (joinButton) joinButton.hidden = true;
    return;
  }

  try {
    const result = await apiRequest(
      `${GROUPS_URL}/${encodeURIComponent(groupId)}`
    );

    const group = result.data;

    if (!group) {
      throw new Error("Study group not found.");
    }

    const title = group.title || group.name || "Study Group";

    document.title = `${title} | StudentCircle`;
    nameElement.textContent = title;

    const subjectElement = document.getElementById("detailSubject");
    const iconElement = document.getElementById("detailIcon");
    const descriptionElement =
      document.getElementById("detailDescription");
    const membersElement = document.getElementById("detailMembers");
    const timeElement = document.getElementById("detailTime");
    const scheduleElement = document.getElementById("scheduleTime");

    if (subjectElement) {
      subjectElement.textContent = group.subject || "General";
    }

    if (iconElement) {
      iconElement.textContent = groupInitials(title);
    }

    if (descriptionElement) {
      descriptionElement.textContent = group.description || "";
    }

    if (membersElement) {
      const approved = (group.joinRequests || []).filter(
        (request) => request.status === "Approved"
      ).length;

      membersElement.textContent = String(approved + 1);
    }

    if (timeElement) {
      timeElement.textContent = groupTime(group);
    }

    if (scheduleElement) {
      scheduleElement.textContent = groupTime(group);
    }

    function showRequestStatus() {
      const user = getCurrentUser();
      const request = getRequestForCurrentUser(group);

      if (!joinButton) return;

      if (user && group.creatorId &&
          String(group.creatorId) === String(user.id)) {
        joinButton.textContent = "Your Group";
        joinButton.disabled = true;

        if (joinMessage) {
          joinMessage.hidden = false;
          joinMessage.textContent =
            "You created this study group.";
        }

        return;
      }

      if (!request) return;

      joinButton.textContent =
        request.status === "Approved"
          ? "Joined ✓"
          : request.status === "Rejected"
            ? "Request Again"
            : "Request Pending";

      joinButton.disabled = request.status !== "Rejected";

      if (joinMessage) {
        joinMessage.hidden = false;
        joinMessage.textContent =
          request.status === "Approved"
            ? "Your join request has been approved."
            : request.status === "Rejected"
              ? "Your previous request was rejected."
              : "Your join request has been submitted.";
      }
    }

    joinButton?.addEventListener("click", async () => {
      if (!requireLogin()) return;

      joinButton.disabled = true;

      try {
        await apiRequest(
          `${GROUPS_URL}/${encodeURIComponent(groupId)}/join`,
          {
            method: "POST",
            body: JSON.stringify({
              message: ""
            })
          }
        );

        if (joinMessage) {
          joinMessage.hidden = false;
          joinMessage.textContent =
            "Your join request has been submitted.";
        }

        joinButton.textContent = "Request Pending";
        joinButton.disabled = true;

        alert("Your join request was submitted!");
      } catch (error) {
        alert(error.message);
        console.error("Join request error:", error);

        joinButton.disabled = false;

        // Refresh the page state if this user already has a request.
        try {
          const refreshed = await apiRequest(
            `${GROUPS_URL}/${encodeURIComponent(groupId)}`
          );

          if (refreshed.data) {
            Object.assign(group, refreshed.data);
            showRequestStatus();
          }
        } catch (refreshError) {
          console.error(refreshError);
        }
      }
    });

    showRequestStatus();
  } catch (error) {
    nameElement.textContent = "Could not load this study group";

    const descriptionElement =
      document.getElementById("detailDescription");

    if (descriptionElement) {
      descriptionElement.textContent = error.message;
    }

    if (joinButton) joinButton.hidden = true;

    console.error("Group details error:", error);
  }
}

// ==============================
// MY GROUPS PAGE
// ==============================

function initMyGroupsPage() {
  const container = document.getElementById("myGroupsContainer");
  if (!container) return;

  const totalGroupsEl = document.getElementById("totalGroups");
  const pendingRequestsEl = document.getElementById("pendingRequests");
  const emptyState = document.getElementById("myGroupsEmpty");
  const goalBar = document.getElementById("goalProgressBar");
  const goalText = document.getElementById("goalProgressText");
  const sessionsCompletedEl =
    document.getElementById("sessionsCompleted");
  const saveGoalButton = document.getElementById("saveGoal");
  const goalSaveMessage = document.getElementById("goalSaveMessage");

  const currentUser = getCurrentUser();

  if (!isLoggedIn() || !currentUser?.id) {
    container.textContent = "Please log in to view your groups.";
    window.location.href = "login.html";
    return;
  }

  const studentId = String(currentUser.id);
  const studentName = currentUser.name || "";

  // Preserve the existing weekly goal tracker.
  let weeklyGoal = Number(localStorage.getItem(GOAL_KEY)) || 5;

  let completedSessions =
    Number(localStorage.getItem(COMPLETED_SESSIONS_KEY)) || 0;

  function updateGoalDisplay() {
    if (goalBar) {
      const percentage = weeklyGoal > 0
        ? Math.min((completedSessions / weeklyGoal) * 100, 100)
        : 0;

      goalBar.style.width = `${percentage}%`;
    }

    if (goalText) {
      goalText.textContent =
        `${completedSessions} of ${weeklyGoal} sessions completed`;
    }

    if (sessionsCompletedEl) {
      sessionsCompletedEl.textContent = completedSessions;
    }
  }

  if (saveGoalButton) {
    saveGoalButton.onclick = () => {
      const goalInput = document.getElementById("weeklyGoal");
      const enteredGoal = Number(goalInput?.value);

      if (!Number.isFinite(enteredGoal) || enteredGoal < 1) {
        if (goalSaveMessage) {
          goalSaveMessage.textContent =
            "Enter a weekly goal greater than zero.";
        }

        return;
      }

      weeklyGoal = Math.floor(enteredGoal);
      localStorage.setItem(GOAL_KEY, String(weeklyGoal));

      if (goalSaveMessage) {
        goalSaveMessage.textContent = "Weekly goal saved!";
      }

      updateGoalDisplay();
    };
  }

  updateGoalDisplay();

  function createSection(title, requests, status) {
    const section = document.createElement("section");
    section.className = "my-groups-section";

    const heading = document.createElement("h2");
    heading.textContent = `${title} (${requests.length})`;
    section.appendChild(heading);

    if (requests.length === 0) {
      const message = document.createElement("p");
      message.textContent = `No ${title.toLowerCase()} yet.`;
      section.appendChild(message);

      return section;
    }

    requests.forEach(({ group }) => {
      const card = document.createElement("article");
      card.className = "group-card";

      const groupTitle = document.createElement("h3");
      groupTitle.textContent = group.title || "Untitled group";

      const subject = document.createElement("p");
      subject.textContent =
        `Subject: ${group.subject || "Not specified"}`;

      const schedule = document.createElement("p");
      schedule.textContent =
        `Schedule: ${groupTime(group)}`;

      const statusText = document.createElement("p");
      statusText.className = "request-status";
      statusText.textContent = `Request status: ${status}`;

      card.append(groupTitle, subject, schedule, statusText);

      const detailsLink = document.createElement("a");
      detailsLink.href =
        `group-details.html?id=${encodeURIComponent(group._id)}`;
      detailsLink.textContent = "View Group";

      card.appendChild(detailsLink);
      section.appendChild(card);
    });

    return section;
  }

  async function loadMyGroups() {
    container.textContent = "Loading your groups...";

    try {
      const result = await apiRequest(GROUPS_URL);
      const groups = Array.isArray(result.data) ? result.data : [];

      const approved = [];
      const pending = [];
      const rejected = [];

      groups.forEach((group) => {
        (group.joinRequests || []).forEach((request) => {
          let belongsToCurrentUser = false;

          if (request.studentId) {
            belongsToCurrentUser =
              String(request.studentId) === studentId;
          } else {
            // Fallback for requests created before user IDs were stored.
            belongsToCurrentUser =
              (request.studentName || "").trim().toLowerCase() ===
              studentName.trim().toLowerCase();
          }

          if (!belongsToCurrentUser) return;

          const item = { group, request };

          if (request.status === "Approved") {
            approved.push(item);
          } else if (request.status === "Pending") {
            pending.push(item);
          } else if (request.status === "Rejected") {
            rejected.push(item);
          }
        });
      });

      container.replaceChildren();

      container.appendChild(
        createSection("Approved Memberships", approved, "Approved")
      );

      container.appendChild(
        createSection("Pending Requests", pending, "Pending")
      );

      container.appendChild(
        createSection("Rejected Requests", rejected, "Rejected")
      );

      if (totalGroupsEl) {
        totalGroupsEl.textContent = approved.length;
      }

      if (pendingRequestsEl) {
        pendingRequestsEl.textContent = pending.length;
      }

      if (emptyState) {
        emptyState.style.display =
          approved.length + pending.length + rejected.length === 0
            ? "block"
            : "none";
      }
    } catch (error) {
      console.error("My Groups error:", error);
      container.textContent =
        `Could not load your groups. ${error.message}`;
    }
  }

  loadMyGroups();
}

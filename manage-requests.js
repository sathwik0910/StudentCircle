
const API_URL = "http://localhost:5000/api/groups";

const container = document.getElementById("requestsContainer");
const pageMessage = document.getElementById("pageMessage");
const refreshButton = document.getElementById("refreshRequests");

async function loadRequests() {
  container.replaceChildren();
  pageMessage.textContent = "Loading requests...";

  try {
    const response = await fetch(API_URL);
    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.message || "Could not load groups.");
    }

    const groups = result.data || [];
    let requestCount = 0;

    for (const group of groups) {
      const requests = group.joinRequests || [];

      for (const request of requests) {
        requestCount++;

        const card = document.createElement("section");
        card.className = "request-card";

        const title = document.createElement("h2");
        title.textContent = group.title;

        const student = document.createElement("p");
        student.textContent = `Student: ${request.studentName}`;

        const subject = document.createElement("p");
        subject.textContent = `Subject: ${group.subject}`;

        const status = document.createElement("p");
        status.className = "request-status";
        status.textContent = `Status: ${request.status}`;

        card.append(title, student, subject, status);

        if (request.message) {
          const message = document.createElement("p");
          message.textContent = `Message: ${request.message}`;
          card.appendChild(message);
        }

        if (request.status === "Pending") {
          const actions = document.createElement("div");
          actions.className = "request-actions";

          const approveButton = document.createElement("button");
          approveButton.className = "approve-btn";
          approveButton.textContent = "Approve";

          const rejectButton = document.createElement("button");
          rejectButton.className = "reject-btn";
          rejectButton.textContent = "Reject";

          approveButton.addEventListener("click", () =>
            updateRequest(group._id, request._id, "Approved")
          );

          rejectButton.addEventListener("click", () =>
            updateRequest(group._id, request._id, "Rejected")
          );

          actions.append(approveButton, rejectButton);
          card.appendChild(actions);
        }

        container.appendChild(card);
      }
    }

    pageMessage.textContent = requestCount
      ? `${requestCount} request(s) found.`
      : "No join requests found.";
  } catch (error) {
    console.error(error);
    pageMessage.textContent =
      "Could not load requests. Check that the backend is running.";
  }
}

async function updateRequest(groupId, requestId, status) {
  const confirmed = window.confirm(
    `Are you sure you want to ${status.toLowerCase()} this request?`
  );

  if (!confirmed) return;

  pageMessage.textContent = "Saving decision...";

  try {
    const response = await fetch(
      `${API_URL}/${groupId}/requests/${requestId}/status`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ status })
      }
    );

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.message || "Could not update request.");
    }

    pageMessage.textContent = result.message;
    await loadRequests();
  } catch (error) {
    console.error(error);
    pageMessage.textContent = error.message;
  }
}

refreshButton.addEventListener("click", loadRequests);

loadRequests();

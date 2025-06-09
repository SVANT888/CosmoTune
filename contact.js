// Contact Form Validation


// Wait for DOM to be fully loaded
document.addEventListener("DOMContentLoaded", function () {
  // Focus on name field when page loads
  document.getElementById("name").focus();

  // Handle form submission
  const form = document.querySelector("form");
  if (form) {
    form.addEventListener("submit", handleFormSubmission);
  }
});

// Basic form validation
function validateForm() {
  let isValid = true;
  let errorMessage = "";

  // Get form values
  const name = document.getElementById("name").value.trim();
  const email = document.getElementById("email").value.trim();
  const message = document.getElementById("message").value.trim();

  // Validate name
  if (!name) {
    errorMessage += "Name is required.\n";
    isValid = false;
  } else if (name.length < 2) {
    errorMessage += "Name must be at least 2 characters.\n";
    isValid = false;
  }

  // Validate email
  if (!email) {
    errorMessage += "Email is required.\n";
    isValid = false;
  } else if (!email.includes("@") || !email.includes(".")) {
    errorMessage += "Please enter a valid email address.\n";
    isValid = false;
  }

  // Validate message
  if (!message) {
    errorMessage += "Message is required.\n";
    isValid = false;
  } else if (message.length < 10) {
    errorMessage += "Message must be at least 10 characters.\n";
    isValid = false;
  }

  // Show errors if any
  if (!isValid) {
    alert(errorMessage);
  }

  return isValid;
}

// Handle form submission with validation
function handleFormSubmission(event) {
  event.preventDefault();

  // Validate form
  if (!validateForm()) {
    return; // Stop if validation fails
  }

  // Show success message
  showToast(
    "Thank you for contacting us! We will get back to you soon.",
    "success"
  );

  // Reset form
  event.target.reset();

  // Focus back on name field
  document.getElementById("name").focus();
}

// toast notification
function showToast(message, type = "info") {
  const toast = document.getElementById("toastNotification");
  if (toast) {
    toast.textContent = message;
    toast.style.background = type === "success" ? "#10b981" : "#3b82f6";
    toast.style.display = "block";
    toast.style.opacity = "1";

    setTimeout(() => {
      toast.style.opacity = "0";
      setTimeout(() => {
        toast.style.display = "none";
      }, 500);
    }, 3000);
  }
}

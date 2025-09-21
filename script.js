// script.js
const imageUpload = document.getElementById('imageUpload');
const uploadedImage = document.getElementById('uploadedImage');

imageUpload.addEventListener('change', function(event) {
  const file = event.target.files[0];
  const reader = new FileReader();

  reader.onload = function(e) {
    uploadedImage.src = e.target.result;
    uploadedImage.style.display = 'block';
  }

  reader.readAsDataURL(file);
});


// script.js
const hairstyleOptions = document.getElementById('hairstyleOptions');
const imageCanvas = document.getElementById('imageCanvas');
const ctx = imageCanvas.getContext('2d');

hairstyleOptions.addEventListener('click', function(event) {
  if (event.target.tagName === 'IMG') {
    const hairstyleImageSrc = event.target.getAttribute('data-hairstyle');
    applyHairstyle(hairstyleImageSrc);
  }
});

function applyHairstyle(hairstyleSrc) {
  const hairstyleImage = new Image();
  hairstyleImage.src = hairstyleSrc;

  hairstyleImage.onload = function() {
    ctx.drawImage(uploadedImage, 0, 0, imageCanvas.width, imageCanvas.height);  // Draw the uploaded image
    ctx.drawImage(hairstyleImage, 50, 0, 200, 200); // Draw the hairstyle on top (adjust coordinates and size)
  }
}


// script.js (Conceptual - Replace with actual API call)
async function applyHairstyle(hairstyleSrc) {
  const formData = new FormData();
  formData.append('image', imageUpload.files[0]); // The uploaded image file
  formData.append('hairstyle', hairstyleSrc);

  const response = await fetch('https://api.example.com/hairstyle-changer', { // Replace with the actual API endpoint
    method: 'POST',
    body: formData
  });

  const data = await response.json();
  const modifiedImageURL = data.modifiedImageURL;

  // Display the modified image
  const modifiedImage = new Image();
  modifiedImage.src = modifiedImageURL;
  modifiedImage.onload = function() {
    ctx.drawImage(modifiedImage, 0, 0, imageCanvas.width, imageCanvas.height);
  }
}
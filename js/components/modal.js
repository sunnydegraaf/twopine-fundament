let modal = document.querySelector('#modal');
let closeButton = document.querySelector('#modal .close-button');
let openButton = document.querySelector('button#open')

console.log(modal)

openButton.addEventListener('click', () => {
    modal.classList.add('open')
})

closeButton.addEventListener('click', () => {
    modal.classList.remove('open')
})
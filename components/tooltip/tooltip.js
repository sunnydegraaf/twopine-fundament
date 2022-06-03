let open = false;
let tooltip = document.querySelector('.tooltip-container')

document.querySelector('.tooltip-container').addEventListener('click', () => {
    open = !open
    if(open) {
        tooltip.classList.add('open')
    } else {
        tooltip.classList.remove('open')
    }  
})
// Enhanced conversion-focused interactivity
// Industry: Financial Services

document.addEventListener('DOMContentLoaded', () => {
  console.log('Enhanced demo site loaded for: Financial Services');
  
  // Enhanced mobile menu
  const menuToggle = document.querySelector('.menu-toggle, .mobile-toggle, .hamburger');
  const nav = document.querySelector('nav ul, .nav-menu, .mobile-menu');
  
  if (menuToggle && nav) {
    menuToggle.addEventListener('click', () => {
      nav.classList.toggle('active');
      menuToggle.classList.toggle('active');
      document.body.classList.toggle('menu-open');
    });
  }

  // Conversion-focused scroll effects
  const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
  };
  
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('animate-in');
      }
    });
  }, observerOptions);
  
  // Animate sections as they come into view
  document.querySelectorAll('section, .hero, .cta-section').forEach(el => {
    observer.observe(el);
  });

  // Enhanced CTA tracking and effects
  document.querySelectorAll('.cta, .btn-primary, .call-to-action').forEach(cta => {
    cta.addEventListener('click', (e) => {
      // Add conversion tracking here
      console.log('CTA clicked:', cta.textContent.trim());
      
      // Visual feedback
      cta.classList.add('clicked');
      setTimeout(() => cta.classList.remove('clicked'), 200);
    });
    
    // Hover effects for trust-building
    cta.addEventListener('mouseenter', () => {
      cta.classList.add('hover-enhanced');
    });
    
    cta.addEventListener('mouseleave', () => {
      cta.classList.remove('hover-enhanced');
    });
  });

  // Trust signal animations
  document.querySelectorAll('.trust-signal, .testimonial, .stats').forEach(element => {
    observer.observe(element);
  });

  // Smooth scrolling for all anchor links
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', (e) => {
      const target = document.querySelector(anchor.getAttribute('href'));
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ 
          behavior: 'smooth',
          block: 'start'
        });
      }
    });
  });

  // Sticky navigation with enhanced styling
  const header = document.querySelector('header');
  if (header) {
    let lastScrollY = window.scrollY;
    
    window.addEventListener('scroll', () => {
      const currentScrollY = window.scrollY;
      
      // Add scrolled class for styling
      header.classList.toggle('scrolled', currentScrollY > 50);
      
      // Hide/show header on scroll (optional)
      if (currentScrollY > lastScrollY && currentScrollY > 100) {
        header.classList.add('header-hidden');
      } else {
        header.classList.remove('header-hidden');
      }
      
      lastScrollY = currentScrollY;
    });
  }

  // Form enhancement (if forms exist)
  document.querySelectorAll('form').forEach(form => {
    const inputs = form.querySelectorAll('input, textarea');
    
    inputs.forEach(input => {
      // Enhanced focus states
      input.addEventListener('focus', () => {
        input.parentElement.classList.add('field-focused');
      });
      
      input.addEventListener('blur', () => {
        input.parentElement.classList.remove('field-focused');
        if (input.value) {
          input.parentElement.classList.add('field-filled');
        } else {
          input.parentElement.classList.remove('field-filled');
        }
      });
    });
    
    // Form submission tracking
    form.addEventListener('submit', (e) => {
      console.log('Form submission attempted');
      // Add conversion tracking here
    });
  });
  
  // Industry-specific enhancements
  
    // General business enhancements
    console.log('Industry-specific enhancements loaded for: Financial Services');
});

// Add CSS animations for enhanced effects
const style = document.createElement('style');
style.textContent = `
  .animate-in {
    animation: fadeInUp 0.6s ease-out forwards;
  }
  
  @keyframes fadeInUp {
    from {
      opacity: 0;
      transform: translateY(30px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  
  .cta.clicked {
    transform: scale(0.98);
    transition: transform 0.1s ease;
  }
  
  .hover-enhanced {
    transform: translateY(-2px);
    box-shadow: 0 5px 15px rgba(0,0,0,0.2);
    transition: all 0.3s ease;
  }
  
  .header-hidden {
    transform: translateY(-100%);
    transition: transform 0.3s ease;
  }
  
  .field-focused {
    transform: scale(1.02);
    transition: transform 0.2s ease;
  }
`;
document.head.appendChild(style);

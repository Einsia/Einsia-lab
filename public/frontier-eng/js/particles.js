// Particle System · 典雅主题（金灰调）
class ParticleSystem {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) return;
    
    this.ctx = this.canvas.getContext('2d');
    this.particles = [];
    this.particleCount = 80;
    this.maxDistance = 140;
    
    this.init();
    this.animate();
    
    window.addEventListener('resize', () => this.resize());
  }
  
  init() {
    this.resize();
    this.createParticles();
  }
  
  resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }
  
  createParticles() {
    this.particles = [];
    for (let i = 0; i < this.particleCount; i++) {
      this.particles.push({
        x: Math.random() * this.canvas.width,
        y: Math.random() * this.canvas.height,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        radius: Math.random() * 1.5 + 0.8,
        opacity: Math.random() * 0.35 + 0.12
      });
    }
  }
  
  updateParticles() {
    for (let particle of this.particles) {
      particle.x += particle.vx;
      particle.y += particle.vy;
      
      // Wrap around edges
      if (particle.x < 0) particle.x = this.canvas.width;
      if (particle.x > this.canvas.width) particle.x = 0;
      if (particle.y < 0) particle.y = this.canvas.height;
      if (particle.y > this.canvas.height) particle.y = 0;
    }
  }
  
  drawParticles() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
    // Draw connections
    for (let i = 0; i < this.particles.length; i++) {
      for (let j = i + 1; j < this.particles.length; j++) {
        const dx = this.particles[i].x - this.particles[j].x;
        const dy = this.particles[i].y - this.particles[j].y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance < this.maxDistance) {
          const opacity = (1 - distance / this.maxDistance) * 0.18;
          this.ctx.strokeStyle = `rgba(184, 160, 96, ${opacity})`;
          this.ctx.lineWidth = 1;
          this.ctx.beginPath();
          this.ctx.moveTo(this.particles[i].x, this.particles[i].y);
          this.ctx.lineTo(this.particles[j].x, this.particles[j].y);
          this.ctx.stroke();
        }
      }
    }
    
    // Draw particles
    for (let particle of this.particles) {
      this.ctx.fillStyle = `rgba(184, 160, 96, ${particle.opacity})`;
      this.ctx.shadowBlur = 6;
      this.ctx.shadowColor = 'rgba(184, 160, 96, 0.4)';
      this.ctx.beginPath();
      this.ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.shadowBlur = 0;
    }
  }
  
  animate() {
    this.updateParticles();
    this.drawParticles();
    requestAnimationFrame(() => this.animate());
  }
}

// Initialize particle system when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new ParticleSystem('particles-canvas');
});


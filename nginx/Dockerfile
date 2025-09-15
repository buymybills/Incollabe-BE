FROM nginx:1.25-alpine

# Install certbot for SSL certificates
RUN apk add --no-cache certbot certbot-nginx openssl

# Copy custom nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf
COPY conf.d/ /etc/nginx/conf.d/

# Create directories for SSL certificates and logs
RUN mkdir -p /etc/nginx/ssl /var/log/nginx

# Create self-signed certificates for initial setup (will be replaced by Let's Encrypt)
RUN openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout /etc/nginx/ssl/stag.buymybills.in.key \
    -out /etc/nginx/ssl/stag.buymybills.in.crt \
    -subj "/C=IN/ST=State/L=City/O=Organization/CN=stag.buymybills.in"

RUN openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout /etc/nginx/ssl/incollab.buymybills.in.key \
    -out /etc/nginx/ssl/incollab.buymybills.in.crt \
    -subj "/C=IN/ST=State/L=City/O=Organization/CN=incollab.buymybills.in"

# Create a script for SSL certificate renewal
RUN echo '#!/bin/sh' > /usr/local/bin/renew-ssl.sh && \
    echo 'certbot renew --nginx --quiet' >> /usr/local/bin/renew-ssl.sh && \
    echo 'nginx -s reload' >> /usr/local/bin/renew-ssl.sh && \
    chmod +x /usr/local/bin/renew-ssl.sh

# Set proper permissions
RUN chmod 644 /etc/nginx/ssl/stag.buymybills.in.crt && \
    chmod 600 /etc/nginx/ssl/stag.buymybills.in.key && \
    chmod 644 /etc/nginx/ssl/incollab.buymybills.in.crt && \
    chmod 600 /etc/nginx/ssl/incollab.buymybills.in.key

# Expose ports
EXPOSE 80 443

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost/health || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]

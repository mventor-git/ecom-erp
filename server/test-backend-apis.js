const http = require('http');

// Test admin login
const loginData = JSON.stringify({
  username: 'configingtheworld@gmail.com',
  password: 'admin123'
});

const loginOptions = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/admin/login',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': loginData.length
  }
};

const loginReq = http.request(loginOptions, (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    console.log('Admin Login:', res.statusCode);
    const response = JSON.parse(data);
    console.log('Response:', response);
    
    if (res.statusCode === 200) {
      // Get session cookie
      const cookies = res.headers['set-cookie'];
      const sessionCookie = cookies?.find(c => c.startsWith('store_sid='));
      
      if (sessionCookie) {
        const cookieValue = sessionCookie.split(';')[0];
        console.log('Session cookie received');
        
        // Test admin products endpoint
        const productsOptions = {
          hostname: 'localhost',
          port: 3000,
          path: '/api/admin/products',
          method: 'GET',
          headers: {
            'Cookie': cookieValue
          }
        };
        
        const productsReq = http.request(productsOptions, (productsRes) => {
          let productsData = '';
          productsRes.on('data', (chunk) => productsData += chunk);
          productsRes.on('end', () => {
            console.log('\nAdmin Products:', productsRes.statusCode);
            if (productsRes.statusCode === 200) {
              const products = JSON.parse(productsData);
              console.log('Products count:', products.length);
            } else {
              console.log('Error:', productsData);
            }
            
            // Test events endpoint
            const eventsOptions = {
              hostname: 'localhost',
              port: 3000,
              path: '/api/admin/events',
              method: 'GET',
              headers: {
                'Cookie': cookieValue
              }
            };
            
            const eventsReq = http.request(eventsOptions, (eventsRes) => {
              let eventsData = '';
              eventsRes.on('data', (chunk) => eventsData += chunk);
              eventsRes.on('end', () => {
                console.log('\nEvents API:', eventsRes.statusCode);
                if (eventsRes.statusCode === 200) {
                  const events = JSON.parse(eventsData);
                  console.log('Events count:', events.length);
                } else {
                  console.log('Error:', eventsData);
                }
                
                // Test users endpoint
                const usersOptions = {
                  hostname: 'localhost',
                  port: 3000,
                  path: '/api/admin/users',
                  method: 'GET',
                  headers: {
                    'Cookie': cookieValue
                  }
                };
                
                const usersReq = http.request(usersOptions, (usersRes) => {
                  let usersData = '';
                  usersRes.on('data', (chunk) => usersData += chunk);
                  usersRes.on('end', () => {
                    console.log('\nUsers API:', usersRes.statusCode);
                    if (usersRes.statusCode === 200) {
                      const users = JSON.parse(usersData);
                      console.log('Users count:', users.length);
                    } else {
                      console.log('Error:', usersData);
                    }
                    
                    // Test roles endpoint
                    const rolesOptions = {
                      hostname: 'localhost',
                      port: 3000,
                      path: '/api/admin/users/roles/list',
                      method: 'GET',
                      headers: {
                        'Cookie': cookieValue
                      }
                    };
                    
                    const rolesReq = http.request(rolesOptions, (rolesRes) => {
                      let rolesData = '';
                      rolesRes.on('data', (chunk) => rolesData += chunk);
                      rolesRes.on('end', () => {
                        console.log('\nRoles API:', rolesRes.statusCode);
                        if (rolesRes.statusCode === 200) {
                          const roles = JSON.parse(rolesData);
                          console.log('Roles count:', roles.length);
                        } else {
                          console.log('Error:', rolesData);
                        }
                        
                        // Test permissions endpoint
                        const permsOptions = {
                          hostname: 'localhost',
                          port: 3000,
                          path: '/api/admin/users/permissions/list',
                          method: 'GET',
                          headers: {
                            'Cookie': cookieValue
                          }
                        };
                        
                        const permsReq = http.request(permsOptions, (permsRes) => {
                          let permsData = '';
                          permsRes.on('data', (chunk) => permsData += chunk);
                          permsRes.on('end', () => {
                            console.log('\nPermissions API:', permsRes.statusCode);
                            if (permsRes.statusCode === 200) {
                              const perms = JSON.parse(permsData);
                              console.log('Permissions count:', perms.length);
                            } else {
                              console.log('Error:', permsData);
                            }
                            
                            console.log('\n=== All Backend API Tests Complete ===');
                          });
                        });
                        permsReq.end();
                      });
                    });
                    rolesReq.end();
                  });
                });
                usersReq.end();
              });
            });
            eventsReq.end();
          });
        });
        productsReq.end();
      }
    }
  });
});

loginReq.write(loginData);
loginReq.end();
